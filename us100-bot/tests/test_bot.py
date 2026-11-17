from dataclasses import replace
from datetime import date

import numpy as np
import pandas as pd
import pytest

from us100bot.backtest import run_backtest
from us100bot.config import Config, Risk, Strategy, load_config, validate
from us100bot.live import bars_to_frame, is_paper_account, session_close
from us100bot.risk import DayState, position_size
from us100bot.strategy import add_indicators, build_signal, can_enter_after, regular_session

CFG = load_config()
# Short EMAs so one constructed session is enough to warm the indicators up.
FAST = replace(CFG, strategy=replace(CFG.strategy, ema_fast=5, ema_slow=12, slope_lookback=2, atr_period=3))


def session_bars(closes, day="2026-03-02", spread=2.0, start="09:30"):
    """5-minute bars for one session; each bar opens at the previous close."""
    idx = pd.date_range(f"{day} {start}", periods=len(closes), freq="5min", tz="America/New_York")
    closes = np.asarray(closes, dtype=float)
    opens = np.concatenate([[closes[0]], closes[:-1]])
    return pd.DataFrame({"open": opens, "high": np.maximum(opens, closes) + spread,
                         "low": np.minimum(opens, closes) - spread, "close": closes}, index=idx)


def uptrend_with_pullback(after):
    """Steady rise, a two-bar dip to the fast EMA, a strong up bar, then `after`."""
    rise = list(np.arange(20000, 20000 + 30 * 10, 10.0))        # 09:30 .. 11:55
    return session_bars(rise + [rise[-1] - 10, rise[-1] - 18, rise[-1] + 6] + after)


def test_config_loads_and_rejects_bad_values():
    assert CFG.instrument.symbol == "MNQ" and CFG.ibkr.allow_live is False
    with pytest.raises(ValueError):
        validate(replace(CFG, strategy=Strategy(ema_fast=50, ema_slow=20)))
    with pytest.raises(ValueError):
        validate(replace(CFG, risk=Risk(max_contracts=0)))


def test_position_size_caps_risk():
    # 0.5% of 25k = $125 risk; 20-point stop on MNQ = $40/contract -> 3 contracts.
    assert position_size(25000, 20, CFG) == 3
    assert position_size(25000, 100, CFG) == 0          # one contract would risk $200
    assert position_size(1_000_000, 5, CFG) == CFG.risk.max_contracts


def test_day_state_limits():
    day = DayState()
    day.roll("2026-03-02", 25000)
    assert day.may_trade(25000, CFG)
    assert not day.may_trade(25000 - 375, CFG)          # 1.5% daily loss
    day.trades = CFG.risk.max_trades_per_day
    assert not day.may_trade(25000, CFG)
    day.roll("2026-03-03", 24000)
    assert day.trades == 0 and day.start_equity == 24000


def test_regular_session_filters_and_converts():
    idx = pd.date_range("2026-03-02 13:00", periods=60, freq="5min", tz="UTC")   # 08:00-12:55 ET
    df = pd.DataFrame({"open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0}, index=idx)
    rth = regular_session(df, CFG.session)
    assert rth.index[0].strftime("%H:%M") == "09:30" and str(rth.index.tz) == "America/New_York"
    with pytest.raises(ValueError):
        regular_session(df.tz_localize(None), CFG.session)


def test_indicators_do_not_look_ahead():
    rng = np.random.default_rng(1)
    bars = session_bars(20000 + rng.normal(0, 8, 78).cumsum())
    full = add_indicators(bars, FAST)
    part = add_indicators(bars.iloc[:50], FAST)
    pd.testing.assert_frame_equal(full.iloc[:50], part)


def test_long_signal_on_pullback_and_no_signal_in_flat_tape():
    frame = add_indicators(uptrend_with_pullback([]), FAST)
    assert frame["signal"].iloc[-1] == 1
    assert (frame["signal"].iloc[:-1] == 0).all()        # no pullback during the straight rise
    sig = build_signal(frame.iloc[-1], FAST)
    assert sig.stop < sig.ref_price < sig.target
    assert sig.target - sig.ref_price == pytest.approx(2 * (sig.ref_price - sig.stop), abs=0.5)
    assert sig.stop % 0.25 == 0 and sig.target % 0.25 == 0
    flat = add_indicators(session_bars([20000.0] * 78), FAST)
    assert (flat["signal"] == 0).all()


def test_short_signal_mirrors_long_and_can_be_disabled():
    bars = uptrend_with_pullback([])
    mirrored = bars.copy()
    for col, src in (("open", "open"), ("close", "close"), ("high", "low"), ("low", "high")):
        mirrored[col] = 40000 - bars[src]
    assert add_indicators(mirrored, FAST)["signal"].iloc[-1] == -1
    no_shorts = replace(FAST, strategy=replace(FAST.strategy, allow_shorts=False))
    assert (add_indicators(mirrored, no_shorts)["signal"] == 0).all()


def test_entry_window():
    ts = lambda hhmm: pd.Timestamp(f"2026-03-02 {hhmm}", tz="America/New_York")
    assert not can_enter_after(ts("09:50"), CFG)         # closes 09:55, before 10:00
    assert can_enter_after(ts("09:55"), CFG)
    assert can_enter_after(ts("15:25"), CFG)
    assert not can_enter_after(ts("15:30"), CFG)


def backtest_one(after):
    result = run_backtest(uptrend_with_pullback(after), FAST)
    assert len(result.trades) >= 1
    return result, result.trades[0]


def test_backtest_target_exit():
    result, t = backtest_one(list(np.arange(20308, 20308 + 40 * 12, 12.0)))
    assert t.reason == "target" and t.side == 1 and t.exit == t.target
    assert t.entry_time.strftime("%H:%M") == "12:15"     # bar after the 12:10 signal bar
    assert t.entry == 20296 + 0.25                       # next open plus one tick of slippage
    gross = (t.exit - t.entry) * t.contracts * 2
    assert t.pnl == pytest.approx(gross - 2 * 0.62 * t.contracts)
    assert result.summary()["trades"] == len(result.trades)


def test_backtest_stop_exit_includes_slippage():
    _, t = backtest_one(list(np.arange(20284, 20284 - 40 * 12, -12.0)))
    assert t.reason == "stop" and t.exit <= t.stop - 0.25 and t.pnl < 0
    assert t.r_multiple < -1                             # slippage and fees make a stop worse than -1R


def test_backtest_stop_wins_when_bar_hits_both():
    bars = uptrend_with_pullback([20296.0, 20296.0])
    bars.iloc[-1, bars.columns.get_loc("high")] = 21000
    bars.iloc[-1, bars.columns.get_loc("low")] = 19000
    t = run_backtest(bars, FAST).trades[0]
    assert t.reason == "stop"


def test_backtest_flattens_at_end_of_day_and_never_holds_overnight():
    drift = [20296 + 0.5 * i for i in range(1, 46)]      # too slow to reach stop or target
    result, t = backtest_one(drift)
    assert t.reason == "eod" and t.exit_time.strftime("%H:%M") == "15:55"
    for trade in result.trades:
        assert trade.entry_time.date() == trade.exit_time.date()


def test_backtest_respects_max_trades_per_day():
    rng = np.random.default_rng(7)
    days = pd.bdate_range("2026-03-02", periods=40)
    bars = pd.concat([session_bars(20000 + rng.normal(0.5, 12, 78).cumsum(), day=str(d.date())) for d in days])
    loose = replace(FAST, risk=replace(FAST.risk, max_trades_per_day=2))
    result = run_backtest(bars, loose)
    per_day = result.trades_frame().groupby(result.trades_frame()["entry_time"].dt.date).size()
    assert len(result.trades) > 20 and per_day.max() <= 2
    s = result.summary()
    assert s["max_drawdown_pct"] <= 0 and s["exits"]["target"] + s["exits"]["stop"] + s["exits"]["eod"] == s["trades"]


def test_session_close_handles_normal_early_and_closed_days():
    hours = "20261125:0830-20261125:1600;20261126:CLOSED;20261127:0830-20261127:1215"
    assert session_close(hours, "US/Central", date(2026, 11, 25)).strftime("%H:%M") == "16:00"
    assert session_close(hours, "US/Central", date(2026, 11, 27)).strftime("%H:%M") == "12:15"
    assert session_close(hours, "US/Central", date(2026, 11, 26)) is None
    assert session_close(hours, "US/Central", date(2026, 12, 1)) is None


def test_paper_account_detection_and_bar_conversion():
    assert is_paper_account("DU1234567") and not is_paper_account("U1234567")

    class Bar:
        def __init__(self, when):
            self.date, self.open, self.high, self.low, self.close = when, 1.0, 2.0, 0.5, 1.5
    frame = bars_to_frame([Bar(pd.Timestamp("2026-03-02 14:30", tz="UTC").to_pydatetime())])
    assert str(frame.index.tz) == "UTC" and frame["close"].iloc[0] == 1.5


# ---- live runner against a fake IBKR client (no gateway needed) ---------------

class FakeIB:
    def __init__(self, accounts=("DU111",), position=0.0, equity=25000.0):
        from types import SimpleNamespace as NS
        self.NS, self.accounts, self.pos, self.eq = NS, list(accounts), position, equity
        self.placed, self.cancelled, self.working, self._id = [], [], [], 100
        self.client = NS(getReqId=self._next_id)

    def _next_id(self):
        self._id += 1
        return self._id

    def connect(self, *a, **k): pass
    def managedAccounts(self): return self.accounts
    def sleep(self, secs=0): return True
    def accountValues(self, account=""): return [self.NS(tag="NetLiquidation", currency="USD", value=str(self.eq))]
    def positions(self, account=""): return [self.NS(position=self.pos, contract=self.NS(conId=1))]
    def openTrades(self): return self.working
    def cancelOrder(self, order): self.cancelled.append(order)
    def placeOrder(self, contract, order): self.placed.append(order)


def make_trader(monkeypatch, tmp_path, fake, **kwargs):
    import us100bot.live as live
    monkeypatch.setattr(live, "STATE_FILE", tmp_path / "day.json")
    trader = live.LiveTrader(FAST, **kwargs)
    trader.ib, trader.account = fake, fake.accounts[0]
    trader.contract = fake.NS(conId=1, localSymbol="MNQH6")
    trader.day.roll("2026-03-02", fake.eq)
    return trader


def live_bars():
    """Completed bars ending in a long signal, plus one bar that is still forming."""
    frame = uptrend_with_pullback([20296.0])
    Bar = lambda ts, r: FakeIB().NS(date=ts.tz_convert("UTC").to_pydatetime(), open=r.open, high=r.high, low=r.low, close=r.close)
    bars = [Bar(ts, r) for ts, r in zip(frame.index, frame.itertuples())]
    now = (frame.index[-1] + pd.Timedelta(seconds=3)).to_pydatetime()
    return bars, now


def test_live_sends_bracket_order_on_signal(monkeypatch, tmp_path):
    fake = FakeIB()
    trader = make_trader(monkeypatch, tmp_path, fake)
    bars, now = live_bars()
    trader.on_bar_close(bars, now, FAST.session.flatten_at)
    parent, target, stop = fake.placed
    assert (parent.action, parent.orderType, parent.transmit) == ("BUY", "MKT", False)
    assert (target.action, target.orderType, target.parentId, target.transmit) == ("SELL", "LMT", parent.orderId, False)
    assert (stop.action, stop.orderType, stop.parentId, stop.transmit) == ("SELL", "STP", parent.orderId, True)
    assert stop.auxPrice < 20296 < target.lmtPrice and stop.tif == "GTC"
    assert parent.totalQuantity == target.totalQuantity == stop.totalQuantity >= 1
    risk = (20296 - stop.auxPrice) * 2 * parent.totalQuantity
    assert risk <= 25000 * 0.005
    assert trader.day.trades == 1
    # Same backtest fill assumptions: stop/target equal what the backtester used for this setup.
    bt = run_backtest(uptrend_with_pullback(list(np.arange(20308, 20308 + 40 * 12, 12.0))), FAST).trades[0]
    assert (bt.stop, bt.target) == (stop.auxPrice, target.lmtPrice)


@pytest.mark.parametrize("setup", ["in_position", "working_order", "loss_limit", "max_trades", "stale", "dry_run", "past_flatten"])
def test_live_does_not_enter_when_blocked(monkeypatch, tmp_path, setup):
    fake = FakeIB()
    trader = make_trader(monkeypatch, tmp_path, fake, dry_run=setup == "dry_run")
    bars, now = live_bars()
    flatten_at = FAST.session.flatten_at
    if setup == "in_position": fake.pos = 1
    if setup == "working_order": fake.working = [fake.NS(contract=fake.NS(conId=1), isDone=lambda: False, order=object())]
    if setup == "loss_limit": fake.eq = 25000 - 400
    if setup == "max_trades": trader.day.trades = FAST.risk.max_trades_per_day
    if setup == "stale": now = now + pd.Timedelta(minutes=10)
    if setup == "past_flatten": flatten_at = now.time()
    trader.on_bar_close(bars, now, flatten_at)
    assert fake.placed == []


def test_live_flatten_cancels_orders_and_closes_position(monkeypatch, tmp_path):
    fake = FakeIB(position=-2)
    resting = object()
    fake.working = [fake.NS(contract=fake.NS(conId=1), isDone=lambda: False, order=resting)]
    trader = make_trader(monkeypatch, tmp_path, fake)
    trader.flatten("test")
    assert fake.cancelled == [resting]
    (close,) = fake.placed
    assert (close.action, close.orderType, close.totalQuantity) == ("BUY", "MKT", 2)


def test_live_refuses_real_account_without_both_switches(monkeypatch, tmp_path):
    for live_flag, allow in ((False, False), (True, False), (False, True)):
        cfg = replace(FAST, ibkr=replace(FAST.ibkr, allow_live=allow))
        fake = FakeIB(accounts=("U999",))
        trader = make_trader(monkeypatch, tmp_path, fake, live=live_flag)
        trader.cfg = cfg
        with pytest.raises(SystemExit, match="LIVE account"):
            trader.connect()
