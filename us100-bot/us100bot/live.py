"""Live / paper trading against Interactive Brokers (TWS or IB Gateway) via ib_async.

Safety properties:
  - Refuses to trade a non-paper account unless config allow_live is true AND --live is passed.
  - Every entry is sent as a bracket: the stop and target sit on IBKR's servers, so the
    position stays protected if this process or its connection dies.
  - One position at a time; no entry while any order for the contract is still working.
  - Daily loss limit is checked against account net liquidation (includes open P&L);
    breaching it flattens and stops trading until the next session.
  - Everything is flattened before the session close, read from the exchange calendar
    so early-close days are handled.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

from .config import Config
from .risk import DayState, position_size
from .strategy import LONG, Signal, add_indicators, build_signal, can_enter_after, regular_session

log = logging.getLogger("us100bot")
STATE_FILE = Path(__file__).resolve().parent.parent / "state" / "day.json"


def session_close(liquid_hours: str, exchange_tz: str, day: date) -> datetime | None:
    """Latest regular-session close on `day` from an IBKR liquidHours string.

    Format: "20261117:0830-20261117:1500;20261118:CLOSED;...". Returns None if the
    exchange is closed that day or the day is not listed.
    """
    tz = ZoneInfo(exchange_tz)
    closes = []
    for part in filter(None, liquid_hours.split(";")):
        if "-" not in part:
            continue
        end = datetime.strptime(part.split("-")[1], "%Y%m%d:%H%M").replace(tzinfo=tz)
        if end.date() == day:
            closes.append(end)
    return max(closes) if closes else None


def is_paper_account(account: str) -> bool:
    return account.upper().startswith("D")   # IBKR paper accounts are DU… / DF…


def bars_to_frame(bars) -> pd.DataFrame:
    df = pd.DataFrame(
        {"open": [b.open for b in bars], "high": [b.high for b in bars],
         "low": [b.low for b in bars], "close": [b.close for b in bars]},
        index=pd.DatetimeIndex([pd.Timestamp(b.date) for b in bars], name="time"),
    )
    return df.tz_localize("UTC") if df.index.tz is None else df.tz_convert("UTC")


class LiveTrader:
    def __init__(self, cfg: Config, live: bool = False, dry_run: bool = False):
        from ib_async import IB
        self.cfg, self.live, self.dry_run = cfg, live, dry_run
        self.tz = ZoneInfo(cfg.session.timezone)
        self.ib = IB()
        self.account = ""
        self.contract = None
        self.details = None
        self.day = DayState()
        self.flattened_day = ""
        self.halted_day = ""
        self._load_state()

    # ---- persistence -------------------------------------------------------
    def _load_state(self) -> None:
        if STATE_FILE.exists():
            raw = json.loads(STATE_FILE.read_text())
            self.day = DayState(raw["day"], raw["start_equity"], raw["trades"])
            self.halted_day = raw.get("halted_day", "")

    def _save_state(self) -> None:
        STATE_FILE.parent.mkdir(exist_ok=True)
        STATE_FILE.write_text(json.dumps({"day": self.day.day, "start_equity": self.day.start_equity,
                                          "trades": self.day.trades, "halted_day": self.halted_day}))

    # ---- connection and contract --------------------------------------------
    def connect(self) -> None:
        c = self.cfg.ibkr
        self.ib.connect(c.host, c.port, clientId=c.client_id, timeout=15)
        accounts = self.ib.managedAccounts()
        self.account = c.account or (accounts[0] if len(accounts) == 1 else "")
        if self.account not in accounts:
            raise SystemExit(f"Set [ibkr].account to one of {accounts}")
        if not is_paper_account(self.account):
            if not (c.allow_live and self.live):
                raise SystemExit(f"{self.account} is a LIVE account. Refusing to trade it: this needs both "
                                 "allow_live = true in config.toml and the --live flag.")
            log.warning("TRADING LIVE ACCOUNT %s WITH REAL MONEY", self.account)
        log.info("Connected to %s:%s, account %s%s", c.host, c.port, self.account,
                 " (dry run: no orders will be sent)" if self.dry_run else "")
        self.resolve_contract()

    def resolve_contract(self) -> None:
        """Pick the nearest future that is not within roll_days_before_expiry of expiring."""
        from ib_async import Future
        inst = self.cfg.instrument
        found = self.ib.reqContractDetails(Future(inst.symbol, exchange=inst.exchange, currency=inst.currency))
        cutoff = (datetime.now(self.tz).date() + timedelta(days=inst.roll_days_before_expiry)).strftime("%Y%m%d")
        usable = sorted((d for d in found if d.contract.lastTradeDateOrContractMonth[:8] > cutoff),
                        key=lambda d: d.contract.lastTradeDateOrContractMonth)
        if not usable:
            raise SystemExit(f"No tradable {inst.symbol} future found on {inst.exchange}")
        self.details = usable[0]
        self.contract = self.details.contract
        if float(self.contract.multiplier or 0) != inst.multiplier:
            raise SystemExit(f"Config multiplier {inst.multiplier} does not match {self.contract.localSymbol} "
                             f"multiplier {self.contract.multiplier}")
        log.info("Trading %s (expires %s)", self.contract.localSymbol, self.contract.lastTradeDateOrContractMonth)

    # ---- account and position state -------------------------------------------
    def equity(self) -> float:
        for v in self.ib.accountValues(self.account):
            if v.tag == "NetLiquidation" and v.currency != "BASE":
                return float(v.value)
        raise RuntimeError("NetLiquidation not available yet")

    def position(self) -> float:
        return sum(p.position for p in self.ib.positions(self.account) if p.contract.conId == self.contract.conId)

    def working_orders(self) -> list:
        return [t for t in self.ib.openTrades() if t.contract.conId == self.contract.conId and not t.isDone()]

    def flatten_time(self, now: datetime) -> time | None:
        """Time today by which we must be flat, or None if the exchange is closed today."""
        close = session_close(self.details.liquidHours, self.details.timeZoneId, now.date())
        if close is None:
            return None
        early = (close.astimezone(self.tz) - timedelta(minutes=5)).time()
        return min(self.cfg.session.flatten_at, early)

    # ---- orders -----------------------------------------------------------------
    def enter(self, sig: Signal, qty: int) -> None:
        from ib_async import LimitOrder, MarketOrder, StopOrder
        action, exit_action = ("BUY", "SELL") if sig.side == LONG else ("SELL", "BUY")
        log.info("ENTRY %s %d %s  ref %.2f  stop %.2f  target %.2f", action, qty,
                 self.contract.localSymbol, sig.ref_price, sig.stop, sig.target)
        self.day.trades += 1
        self._save_state()
        if self.dry_run:
            return
        new_id = self.ib.client.getReqId
        parent = MarketOrder(action, qty, orderId=new_id(), account=self.account, tif="DAY", transmit=False)
        target = LimitOrder(exit_action, qty, sig.target, orderId=new_id(), parentId=parent.orderId,
                            account=self.account, tif="GTC", transmit=False)
        stop = StopOrder(exit_action, qty, sig.stop, orderId=new_id(), parentId=parent.orderId,
                         account=self.account, tif="GTC", transmit=True)   # last leg transmits all three
        for order in (parent, target, stop):
            self.ib.placeOrder(self.contract, order)

    def flatten(self, reason: str) -> None:
        orders, pos = self.working_orders(), self.position()
        if not orders and pos == 0:
            return
        log.info("FLATTEN (%s): cancelling %d orders, position %+g", reason, len(orders), pos)
        if self.dry_run:
            return
        from ib_async import MarketOrder
        for trade in orders:
            self.ib.cancelOrder(trade.order)
        self.ib.sleep(2)
        pos = self.position()                 # re-read: a stop may have filled while cancelling
        if pos != 0:
            self.ib.placeOrder(self.contract, MarketOrder("SELL" if pos > 0 else "BUY", abs(pos),
                                                          account=self.account, tif="DAY"))
            self.ib.sleep(2)
            if self.position() != 0:
                log.error("Position still open after flatten order. CHECK TWS NOW.")

    # ---- main loop ---------------------------------------------------------------
    def on_bar_close(self, bars, now: datetime, flatten_at: time) -> None:
        done = bars[-2]                                            # bars[-1] is still forming
        stamp = pd.Timestamp(done.date).tz_convert(self.tz)
        age = now - (stamp + timedelta(minutes=self.cfg.strategy.bar_minutes))
        if age > timedelta(minutes=1):
            return                                                 # stale bar (reconnect / session gap)
        if not can_enter_after(stamp, self.cfg) or now.time() >= flatten_at:
            return
        if self.halted_day == self.day.day or self.position() != 0 or self.working_orders():
            return
        equity = self.equity()
        if not self.day.may_trade(equity, self.cfg):
            return
        frame = add_indicators(regular_session(bars_to_frame(bars[:-1]), self.cfg.session), self.cfg)
        if frame.empty or frame.index[-1] != stamp:
            return
        sig = build_signal(frame.iloc[-1], self.cfg)
        if sig is None:
            return
        qty = position_size(equity, sig.stop_points, self.cfg)
        if qty == 0:
            log.info("Signal skipped: one contract risks more than %.2f%% of equity", self.cfg.risk.risk_per_trade_pct)
            return
        self.enter(sig, qty)

    def run(self) -> None:
        self.connect()
        bar_size = f"{self.cfg.strategy.bar_minutes} mins"
        bars = self.ib.reqHistoricalData(self.contract, "", "5 D", bar_size, "TRADES",
                                         useRTH=True, formatDate=2, keepUpToDate=True)
        if len(bars) < self.cfg.strategy.ema_slow * 2:
            raise SystemExit("Not enough history returned; check the market data subscription for CME futures")
        last_stamp = bars[-1].date
        log.info("Loaded %d bars; waiting for bar closes", len(bars))
        ticks = 0
        while self.ib.isConnected():
            self.ib.sleep(1)
            ticks += 1
            now = datetime.now(self.tz)
            today = now.date().isoformat()
            if today != self.day.day:
                self.day.roll(today, self.equity())
                self._save_state()
                rolled_from = self.contract.conId
                self.resolve_contract()
                if self.contract.conId != rolled_from:
                    return                                         # reconnect loop restarts on the new contract
            flatten_at = self.flatten_time(now)
            if flatten_at is None:
                continue                                           # exchange closed today
            if now.time() >= flatten_at and self.flattened_day != today:
                self.flatten("end of session")
                self.flattened_day = today
            if ticks % 15 == 0 and self.halted_day != today and self.day.loss_limit_hit(self.equity(), self.cfg):
                log.warning("Daily loss limit hit; no more trades today")
                self.halted_day = today
                self._save_state()
                self.flatten("daily loss limit")
            if bars[-1].date != last_stamp:
                last_stamp = bars[-1].date
                if len(bars) >= 2:
                    self.on_bar_close(bars, now, flatten_at)
        log.warning("Disconnected from IBKR")


def run_forever(cfg: Config, live: bool, dry_run: bool) -> None:
    """Run, reconnecting after connection drops. Resting stops stay active at IBKR meanwhile."""
    import time as clock
    while True:
        trader = LiveTrader(cfg, live=live, dry_run=dry_run)
        try:
            trader.run()
        except (ConnectionError, OSError, TimeoutError) as exc:
            log.error("Connection problem: %s", exc)
        finally:
            if trader.ib.isConnected():
                trader.ib.disconnect()
        log.info("Reconnecting in 30s")
        clock.sleep(30)


def fetch_history(cfg: Config, days: int, out: str) -> int:
    """Download continuous-contract bars from IBKR into a CSV usable by the backtester."""
    from ib_async import IB, ContFuture
    ib = IB()
    ib.connect(cfg.ibkr.host, cfg.ibkr.port, clientId=cfg.ibkr.client_id + 1, timeout=15)
    try:
        inst = cfg.instrument
        contract = ContFuture(inst.symbol, exchange=inst.exchange, currency=inst.currency)
        ib.qualifyContracts(contract)
        bars = ib.reqHistoricalData(contract, "", f"{days} D", f"{cfg.strategy.bar_minutes} mins", "TRADES",
                                    useRTH=True, formatDate=2, timeout=300)
        frame = bars_to_frame(bars)
        frame.to_csv(out)
        return len(frame)
    finally:
        ib.disconnect()
