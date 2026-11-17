"""Bar-by-bar backtester for the EMA pullback strategy.

Fill assumptions, all chosen to be pessimistic rather than flattering:
  - A signal on bar N is filled at the open of bar N+1, plus slippage.
  - If a bar touches both stop and target, the stop is assumed to have been hit first.
  - Stops fill with slippage, and at the bar's open if price gapped through them.
  - Targets fill at the limit price (or the open if price gapped through).
  - Any open position is closed at the open of the flatten_at bar, with slippage.
  - Commission is charged per contract on every fill.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import pandas as pd

from .config import Config
from .risk import DayState, position_size
from .strategy import Signal, add_indicators, build_signal, can_enter_after, regular_session


@dataclass
class Trade:
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp
    side: int
    contracts: int
    entry: float
    exit: float
    stop: float
    target: float
    reason: str        # "stop", "target" or "eod"
    pnl: float         # dollars, after commission
    r_multiple: float  # pnl / dollars initially at risk


@dataclass
class Result:
    trades: list[Trade]
    equity_curve: pd.Series   # equity after each trade, indexed by exit time
    starting_equity: float

    def trades_frame(self) -> pd.DataFrame:
        return pd.DataFrame([asdict(t) for t in self.trades])

    def summary(self) -> dict:
        n = len(self.trades)
        if n == 0:
            return {"trades": 0}
        pnl = pd.Series([t.pnl for t in self.trades])
        wins, losses = pnl[pnl > 0], pnl[pnl <= 0]
        curve = pd.concat([pd.Series([self.starting_equity]), self.equity_curve.reset_index(drop=True)])
        drawdown = (curve - curve.cummax()) / curve.cummax()
        days = pd.Series(pnl.values, index=[t.exit_time.date() for t in self.trades]).groupby(level=0).sum()
        return {
            "trades": n,
            "trading_days_with_trades": int(len(days)),
            "win_rate_pct": round(100 * len(wins) / n, 1),
            "net_pnl": round(pnl.sum(), 2),
            "return_pct": round(100 * pnl.sum() / self.starting_equity, 2),
            "profit_factor": round(wins.sum() / -losses.sum(), 2) if losses.sum() < 0 else float("inf"),
            "avg_r": round(sum(t.r_multiple for t in self.trades) / n, 3),
            "avg_win": round(wins.mean(), 2) if len(wins) else 0.0,
            "avg_loss": round(losses.mean(), 2) if len(losses) else 0.0,
            "max_drawdown_pct": round(100 * drawdown.min(), 2),
            "worst_day": round(days.min(), 2),
            "best_day": round(days.max(), 2),
            "exits": {r: sum(t.reason == r for t in self.trades) for r in ("target", "stop", "eod")},
        }


def run_backtest(bars: pd.DataFrame, cfg: Config) -> Result:
    """bars: OHLC DataFrame with a timezone-aware DatetimeIndex of bar start times."""
    df = add_indicators(regular_session(bars, cfg.session), cfg)
    slip = cfg.backtest.slippage_ticks * cfg.instrument.tick_size
    mult = cfg.instrument.multiplier
    fee = cfg.backtest.commission_per_contract

    equity = cfg.backtest.starting_equity
    day = DayState()
    trades: list[Trade] = []
    pending: Signal | None = None
    position: dict | None = None

    def close(ts, price, reason):
        nonlocal equity, position
        p = position
        pnl = (price - p["entry"]) * p["side"] * p["qty"] * mult - 2 * fee * p["qty"]
        risked = abs(p["entry"] - p["stop"]) * p["qty"] * mult
        equity += pnl
        trades.append(Trade(p["time"], ts, p["side"], p["qty"], p["entry"], price,
                            p["stop"], p["target"], reason, round(pnl, 2), round(pnl / risked, 3)))
        position = None

    for ts, row in zip(df.index, df.itertuples(index=False)):
        day_key = ts.date().isoformat()
        if day_key != day.day:
            pending = None                      # never carry a signal across sessions
            day.roll(day_key, equity)
        flatten_bar = ts.time() >= cfg.session.flatten_at

        if position and flatten_bar:
            close(ts, row.open - position["side"] * slip, "eod")

        if pending and not position and not flatten_bar:
            entry = row.open + pending.side * slip
            qty = position_size(equity, abs(entry - pending.stop), cfg)
            # Skip if the open gapped beyond the stop or target: the setup is already gone.
            valid = (pending.stop < entry < pending.target) if pending.side > 0 else (pending.target < entry < pending.stop)
            if qty > 0 and valid:
                position = {"time": ts, "side": pending.side, "qty": qty, "entry": entry,
                            "stop": pending.stop, "target": pending.target}
                day.trades += 1
        pending = None

        if position:
            side, stop, target = position["side"], position["stop"], position["target"]
            entered_this_bar = position["time"] == ts
            if side > 0:
                hit_stop, hit_target = row.low <= stop, row.high >= target
                stop_fill = (stop if entered_this_bar else min(stop, row.open)) - slip
                target_fill = target if entered_this_bar else max(target, row.open)
            else:
                hit_stop, hit_target = row.high >= stop, row.low <= target
                stop_fill = (stop if entered_this_bar else max(stop, row.open)) + slip
                target_fill = target if entered_this_bar else min(target, row.open)
            if hit_stop:
                close(ts, stop_fill, "stop")
            elif hit_target:
                close(ts, target_fill, "target")

        if not position and row.signal != 0 and can_enter_after(ts, cfg) and day.may_trade(equity, cfg):
            pending = build_signal(pd.Series(row._asdict()), cfg)

    curve = pd.Series([cfg.backtest.starting_equity + sum(t.pnl for t in trades[: i + 1]) for i in range(len(trades))],
                      index=[t.exit_time for t in trades], dtype=float)
    return Result(trades, curve, cfg.backtest.starting_equity)


def load_bars(path: str) -> pd.DataFrame:
    """Read a CSV with columns time,open,high,low,close[,volume]; time must carry a UTC offset."""
    df = pd.read_csv(path)
    df.columns = [c.lower() for c in df.columns]
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df.set_index("time")[["open", "high", "low", "close"]].astype(float)
