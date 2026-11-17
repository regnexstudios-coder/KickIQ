# US100 intraday bot

Trades the Nasdaq-100 intraday through Interactive Brokers, using Micro E-mini futures
(`MNQ`, $2 per index point) by default. Self-contained: nothing here touches the KickIQ app.

**Status: untested against real market data and against a real IBKR gateway.** The strategy
logic, backtester and order construction are covered by unit tests (the broker is faked in
those tests). No profitability claim is made. Trading futures can lose more than you deposit.
Run it on a paper account first; see [Before real money](#before-real-money).

## Strategy: EMA trend pullback, 5-minute bars

Long setup (shorts are the mirror image):

1. **Trend** – 20 EMA above 50 EMA, and the 50 EMA is rising.
2. **Pullback** – within the last 3 bars price dipped to the 20 EMA without touching the 50 EMA.
3. **Trigger** – the bar closes back above the 20 EMA, closes up, and closes above the prior bar's high.

Entry is a market order at the next bar. Stop is 1.5 × ATR(14) from the signal close, target is
2 × the stop distance. Only regular-session bars (09:30–16:00 New York) are used.

Risk rules:

| Rule | Default |
| --- | --- |
| Risk per trade | 0.5% of account equity (trade skipped if one contract exceeds it) |
| Max contracts | 5 |
| Max trades per day | 3 |
| Daily loss limit | 1.5% of equity, then flat and done for the day |
| Entry window | 10:00–15:30 New York |
| Flat by | 15:55 New York (earlier on exchange early-close days) |
| Positions | one at a time, never held overnight |

All of it is in `config.toml`.

## Setup

```bash
cd us100-bot
python3 -m venv .venv && source .venv/bin/activate    # Python 3.11+
pip install -r requirements.txt
python -m pytest -q
```

In TWS or IB Gateway, logged in to your **paper** account: *Settings → API → Settings*, enable
"ActiveX and Socket Clients", untick "Read-Only API", and check the port matches `[ibkr].port`
(7497 TWS paper, 4002 Gateway paper). Live bars need a CME futures market-data subscription.

## Use

```bash
# 1. Download history from IBKR (continuous contract, regular hours)
python -m us100bot fetch --days 120 --out data/bars.csv

# 2. Backtest it
python -m us100bot backtest data/bars.csv --trades-out data/trades.csv

# 3. Watch signals without sending orders
python -m us100bot run --dry-run

# 4. Trade the paper account
python -m us100bot run
```

`backtest` accepts any CSV with `time,open,high,low,close` where `time` carries a UTC offset.
Logs go to `logs/bot.log`; the day's trade count and starting equity persist in `state/`.

## How the live runner protects the account

- Every entry is a bracket order: stop and target rest on IBKR's servers (GTC), so the position
  stays protected if the bot or your connection dies. The bot reconnects every 30 s.
- It refuses a non-paper account unless `allow_live = true` in `config.toml` **and** `--live` is passed.
- It will not enter while a position or any working order exists on the contract.
- The daily loss limit is measured on account net liquidation, so open losses count.
- It rolls to the next contract 5 days before expiry.

## Backtest assumptions

Entries fill at the next bar's open plus one tick of slippage. If one bar touches both stop and
target, the stop is assumed first. Stops and end-of-day exits pay a tick of slippage, gaps fill at
the open, and commission ($0.62 per contract per side by default; check your own rate) is charged
on every fill. Stop and target prices are computed exactly as the live runner computes them.

## Known limits

- The daily loss limit and sizing read net liquidation in the account's base currency; if that is
  not USD, the percentages are still right but are applied to a non-USD figure against USD risk.
- Trade the contract only from this bot. Manual orders on the same contract confuse its position check.
- The bot must be running at 15:55 New York to flatten. If it is down then, the bracket stop still
  protects the position, but it will be carried past the close until the bot restarts or you close it.
- No news filter: it trades through CPI, FOMC and earnings.
- If the gateway is restarted mid-day, the first bar after reconnecting is ignored.

## Before real money

1. Backtest on at least several months of bars and read the trade list, not just the summary.
2. Change parameters sparingly; every tweak that improves a backtest is partly fitting noise.
   Hold some data back and check the final settings on it once.
3. Run on paper for a few weeks and compare fills with what the backtest assumed.
4. Start live with `max_contracts = 1`.
