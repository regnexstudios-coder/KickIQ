"""Position sizing and daily limits. Shared by the backtester and the live runner."""
from __future__ import annotations

import math
from dataclasses import dataclass

from .config import Config


def position_size(equity: float, stop_points: float, cfg: Config) -> int:
    """Contracts such that hitting the stop loses at most risk_per_trade_pct of equity.

    Returns 0 when even one contract would risk more than that; the trade is then skipped.
    """
    if equity <= 0 or stop_points <= 0:
        return 0
    risk_dollars = equity * cfg.risk.risk_per_trade_pct / 100
    per_contract = stop_points * cfg.instrument.multiplier
    return max(0, min(math.floor(risk_dollars / per_contract), cfg.risk.max_contracts))


@dataclass
class DayState:
    """Per-day counters behind the trade-count and daily-loss limits."""
    day: str = ""
    start_equity: float = 0.0
    trades: int = 0

    def roll(self, day: str, equity: float) -> None:
        if day != self.day:
            self.day, self.start_equity, self.trades = day, equity, 0

    def loss_limit_hit(self, equity: float, cfg: Config) -> bool:
        return self.start_equity - equity >= self.start_equity * cfg.risk.max_daily_loss_pct / 100

    def may_trade(self, equity: float, cfg: Config) -> bool:
        return self.trades < cfg.risk.max_trades_per_day and not self.loss_limit_hit(equity, cfg)
