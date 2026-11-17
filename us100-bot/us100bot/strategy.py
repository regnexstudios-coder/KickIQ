"""EMA trend-pullback strategy on intraday bars.

Pure functions only: the backtester and the live runner both call these, so what is
tested is what trades.

Long setup (shorts are the mirror image):
  1. Trend    - fast EMA above slow EMA, and the slow EMA is rising.
  2. Pullback - within the last few bars price dipped to the fast EMA,
                but never traded down to the slow EMA.
  3. Trigger  - the bar closes back above the fast EMA, closes up, and closes
                above the previous bar's high.
Entry is at the next bar's open. Stop and target are fixed at entry from ATR.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta

import pandas as pd

from .config import Config, Session

LONG, SHORT = 1, -1


@dataclass(frozen=True)
class Signal:
    side: int          # LONG or SHORT
    ref_price: float   # close of the signal bar
    stop: float
    target: float

    @property
    def stop_points(self) -> float:
        return abs(self.ref_price - self.stop)


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False, min_periods=period).mean()


def atr(df: pd.DataFrame, period: int) -> pd.Series:
    prev_close = df["close"].shift(1)
    true_range = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return true_range.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()


def regular_session(df: pd.DataFrame, session: Session) -> pd.DataFrame:
    """Keep only regular-session bars, with the index in the session timezone.

    Bars are stamped with their start time, so the last bar kept starts before rth_end.
    """
    if df.index.tz is None:
        raise ValueError("Bar index must be timezone-aware")
    df = df.tz_convert(session.timezone).sort_index()
    df = df[~df.index.duplicated(keep="last")]
    times = df.index.time
    return df[(times >= session.rth_start) & (times < session.rth_end)]


def add_indicators(df: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    """Return a copy of df with ema_fast, ema_slow, atr and signal (1 / -1 / 0) columns.

    Each row's values use only that bar and earlier ones.
    """
    st = cfg.strategy
    out = df.copy()
    out["ema_fast"] = ema(out["close"], st.ema_fast)
    out["ema_slow"] = ema(out["close"], st.ema_slow)
    out["atr"] = atr(out, st.atr_period)

    fast, slow = out["ema_fast"], out["ema_slow"]
    window = st.pullback_lookback
    ready = slow.shift(st.slope_lookback).notna() & out["atr"].notna()

    up_trend = (fast > slow) & (slow > slow.shift(st.slope_lookback))
    dipped = (out["low"] <= fast).rolling(window).max().fillna(0).astype(bool)
    held = (out["low"] > slow).rolling(window).min().fillna(0).astype(bool)
    up_trigger = (out["close"] > fast) & (out["close"] > out["open"]) & (out["close"] > out["high"].shift(1))
    long_signal = ready & up_trend & dipped & held & up_trigger

    down_trend = (fast < slow) & (slow < slow.shift(st.slope_lookback))
    popped = (out["high"] >= fast).rolling(window).max().fillna(0).astype(bool)
    capped = (out["high"] < slow).rolling(window).min().fillna(0).astype(bool)
    down_trigger = (out["close"] < fast) & (out["close"] < out["open"]) & (out["close"] < out["low"].shift(1))
    short_signal = ready & down_trend & popped & capped & down_trigger & st.allow_shorts

    out["signal"] = long_signal.astype(int) - short_signal.astype(int)
    return out


def round_to_tick(price: float, tick: float) -> float:
    return round(round(price / tick) * tick, 10)


def build_signal(row: pd.Series, cfg: Config) -> Signal | None:
    """Turn an indicator row into a Signal with stop and target prices, or None."""
    side = int(row["signal"])
    if side == 0:
        return None
    tick = cfg.instrument.tick_size
    close = float(row["close"])
    stop_points = max(cfg.strategy.atr_stop_mult * float(row["atr"]), tick)
    stop = round_to_tick(close - side * stop_points, tick)
    target = round_to_tick(close + side * stop_points * cfg.strategy.reward_risk, tick)
    if stop == close or target == close:
        return None
    return Signal(side=side, ref_price=close, stop=stop, target=target)


def bar_close_time(bar_start: datetime, cfg: Config) -> time:
    return (bar_start + timedelta(minutes=cfg.strategy.bar_minutes)).time()


def can_enter_after(bar_start: datetime, cfg: Config) -> bool:
    """True if a signal on the bar starting at bar_start may be traded at its close."""
    closes_at = bar_close_time(bar_start, cfg)
    return cfg.session.entry_start <= closes_at <= cfg.session.entry_end
