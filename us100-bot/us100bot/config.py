"""Typed configuration loaded from config.toml."""
from __future__ import annotations

import tomllib
from dataclasses import dataclass, fields
from datetime import time
from pathlib import Path


def _hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


@dataclass(frozen=True)
class Instrument:
    symbol: str = "MNQ"
    exchange: str = "CME"
    currency: str = "USD"
    multiplier: float = 2.0
    tick_size: float = 0.25
    roll_days_before_expiry: int = 5


@dataclass(frozen=True)
class Session:
    timezone: str = "America/New_York"
    rth_start: time = time(9, 30)
    rth_end: time = time(16, 0)
    entry_start: time = time(10, 0)
    entry_end: time = time(15, 30)
    flatten_at: time = time(15, 55)


@dataclass(frozen=True)
class Strategy:
    bar_minutes: int = 5
    ema_fast: int = 20
    ema_slow: int = 50
    slope_lookback: int = 5
    pullback_lookback: int = 3
    atr_period: int = 14
    atr_stop_mult: float = 1.5
    reward_risk: float = 2.0
    allow_shorts: bool = True


@dataclass(frozen=True)
class Risk:
    risk_per_trade_pct: float = 0.5
    max_contracts: int = 5
    max_trades_per_day: int = 3
    max_daily_loss_pct: float = 1.5


@dataclass(frozen=True)
class Backtest:
    starting_equity: float = 25000.0
    slippage_ticks: int = 1
    commission_per_contract: float = 0.62


@dataclass(frozen=True)
class Ibkr:
    host: str = "127.0.0.1"
    port: int = 7497
    client_id: int = 17
    account: str = ""
    allow_live: bool = False


@dataclass(frozen=True)
class Config:
    instrument: Instrument = Instrument()
    session: Session = Session()
    strategy: Strategy = Strategy()
    risk: Risk = Risk()
    backtest: Backtest = Backtest()
    ibkr: Ibkr = Ibkr()


def _build(cls, raw: dict):
    known = {f.name: f for f in fields(cls)}
    unknown = set(raw) - set(known)
    if unknown:
        raise ValueError(f"Unknown keys in [{cls.__name__.lower()}]: {sorted(unknown)}")
    values = {}
    for name, value in raw.items():
        values[name] = _hhmm(value) if known[name].type == "time" else value
    return cls(**values)


def load_config(path: str | Path | None = None) -> Config:
    """Load config.toml (defaults to the one next to the package)."""
    path = Path(path) if path else Path(__file__).resolve().parent.parent / "config.toml"
    raw = tomllib.loads(path.read_text())
    sections = {f.name: f.default.__class__ for f in fields(Config)}
    unknown = set(raw) - set(sections)
    if unknown:
        raise ValueError(f"Unknown sections in {path}: {sorted(unknown)}")
    cfg = Config(**{name: _build(cls, raw.get(name, {})) for name, cls in sections.items()})
    validate(cfg)
    return cfg


def validate(cfg: Config) -> None:
    s, st, r = cfg.session, cfg.strategy, cfg.risk
    if not (s.rth_start <= s.entry_start < s.entry_end <= s.flatten_at <= s.rth_end):
        raise ValueError("Session times must satisfy rth_start <= entry_start < entry_end <= flatten_at <= rth_end")
    if st.ema_fast >= st.ema_slow:
        raise ValueError("ema_fast must be shorter than ema_slow")
    if min(st.atr_stop_mult, st.reward_risk, r.risk_per_trade_pct, r.max_daily_loss_pct) <= 0:
        raise ValueError("Stop multiple, reward/risk and risk percentages must be positive")
    if r.max_contracts < 1 or r.max_trades_per_day < 1:
        raise ValueError("max_contracts and max_trades_per_day must be at least 1")
