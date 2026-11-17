"""Command line: python -m us100bot {backtest,fetch,run}"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from .config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(prog="us100bot", description="US100 (Nasdaq-100 futures) intraday bot")
    parser.add_argument("--config", help="path to config.toml (default: the one in us100-bot/)")
    sub = parser.add_subparsers(dest="command", required=True)

    bt = sub.add_parser("backtest", help="backtest the strategy on a CSV of bars")
    bt.add_argument("csv", help="CSV with columns time,open,high,low,close")
    bt.add_argument("--trades-out", help="write the trade list to this CSV")

    fetch = sub.add_parser("fetch", help="download historical bars from IBKR for backtesting")
    fetch.add_argument("--days", type=int, default=120)
    fetch.add_argument("--out", default="data/bars.csv")

    run = sub.add_parser("run", help="trade through TWS / IB Gateway (paper account by default)")
    run.add_argument("--live", action="store_true", help="allow a real-money account (also needs allow_live in config)")
    run.add_argument("--dry-run", action="store_true", help="log signals but send no orders")

    args = parser.parse_args()
    cfg = load_config(args.config)

    if args.command == "backtest":
        from .backtest import load_bars, run_backtest
        bars = load_bars(args.csv)
        result = run_backtest(bars, cfg)
        print(f"Bars: {len(bars)}  from {bars.index[0]} to {bars.index[-1]}")
        print(json.dumps(result.summary(), indent=2))
        if args.trades_out:
            result.trades_frame().to_csv(args.trades_out, index=False)
            print(f"Trades written to {args.trades_out}")
    elif args.command == "fetch":
        from .live import fetch_history
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        print(f"Saved {fetch_history(cfg, args.days, args.out)} bars to {args.out}")
    else:
        log_dir = Path(__file__).resolve().parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                            handlers=[logging.StreamHandler(), logging.FileHandler(log_dir / "bot.log")])
        logging.getLogger("ib_async").setLevel(logging.WARNING)
        from .live import run_forever
        run_forever(cfg, live=args.live, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
