# Sensibull True-Price Injector

A Chrome extension that lets you enter your **true, off-grid entry price** for each leg on the
[Sensibull Option Strategy Builder](https://web.sensibull.com/option-strategy-builder), so
Sensibull's own **Payoff Graph, Premium, and Max Profit/Loss are computed from your real cost
basis** — not a rounded approximation of it.

> **Analysis tool, not an order tool.** This extension only corrects the entry prices used for
> charting and analysis. It does **not** place, modify, or submit any order. Order placement and
> pricing remain entirely with Sensibull and your broker.

---

## The problem

Sensibull's Strategy Builder steps and rounds each leg's entry price to the `0.05` exchange tick.
For **large-lot, low-premium** instruments this rounding is a meaningful fraction of the premium,
so the payoff graph — the very thing you use to decide a trade — is drawn from a price you never
actually paid.

Example — **NHPC**, lot size **6950**:

```
One 0.05 tick of rounding = 0.05 × 6950 = ₹347.50 of P&L per leg
```

A two-leg position can be off by ₹500–700 purely from entry-price rounding. Real broker fills are
often **averaged** across partial executions (e.g. an actual average of `0.66`), which is
inherently off the `0.05` grid — so the rounding makes the chart wrong for exactly the positions
you already hold.

## Features

- **Per-leg true-price panel** injected into the builder — one editable field per leg
  (`SYMBOL · strike · BUY/SELL · qty`).
- **Off-grid prices accepted** — type the exact price you paid, to the paisa.
- **Instant, accurate recompute** — the payoff curves, Premium, and Max Profit/Loss update the
  moment you enter a price.
- **Persistent per instrument** — your true prices are remembered (`chrome.storage.local`) and
  re-applied when you return to the same instrument.
- **No synthetic input** — it does not fake typing or clicks; it commits the price through
  Sensibull's own state update.

## Install (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select the repository folder.
5. Open the [Option Strategy Builder](https://web.sensibull.com/option-strategy-builder). A
   **True entry price (chart accuracy)** panel appears with one row per leg.

## Usage

1. Load a strategy (or your existing positions) in the builder.
2. In the panel, type your **true entry price** for each leg and press Enter or click away.
3. The Payoff Graph, Premium, and Max Profit/Loss immediately reflect your real cost basis.
4. Your prices are saved per instrument — reopening the same instrument restores them.

## How it works

Sensibull is a React + Redux application. The payoff engine reads each leg's committed
`entryPrice` — and it already accepts precise, off-grid values with **zero rounding**. The only
place the `0.05` rounding happens is the input field's commit path. This extension routes around
that input path:

1. A **page-world bridge** (`injected.js`) is injected into the tab. It locates Sensibull's Redux
   store by walking the React fiber tree from `#root` to the store held by the `<Provider>`
   (a content script's isolated world cannot reach the page's store directly).
2. It reads the current strategy's legs straight from the store and reports them to the panel.
3. When you enter a price, the panel sends it over a `window.postMessage` bridge; the page-world
   script dispatches Sensibull's own `changeStrategyLegEntryPrice` action with your exact value.
4. Because the price is written straight into Sensibull's engine, every downstream calculation
   recomputes automatically.

The relationship is exactly linear: changing a leg's entry price by Δ shifts the whole payoff
graph by `±quantity × Δ`.

## Project structure

| File | Role |
|------|------|
| `manifest.json` | Manifest V3 definition (content script + web-accessible bridge). |
| `content.js` | Isolated-world: injects the bridge, renders the panel, owns persistence, relays messages. |
| `injected.js` | Page-world bridge: finds the Redux store, reads legs, dispatches entry-price updates. |
| `docs/sensibull-payoff-precision-proposal.md` | A write-up proposing that Sensibull support precise entry prices natively. |

## A note to Sensibull

The cleanest fix belongs in Sensibull itself: use the broker's actual **average fill price**
(paisa precision) as the entry price for held positions, and allow precise manual entry on the
cost-basis field while keeping the *order* price on the `0.05` grid. Since the analyzer already
consumes precise prices, this is primarily an input-layer change. See
[the proposal](docs/sensibull-payoff-precision-proposal.md) for the details and measurements.

## Compatibility

- Google Chrome / Chromium (Manifest V3).
- Works on `https://web.sensibull.com/*`. Requires only the `storage` permission.
- Relies on Sensibull's current front-end structure; a major Sensibull redesign could require an
  update.

## License

[MIT](LICENSE) © Velocity Software Solutions Pvt Ltd.

## Disclaimer

Not affiliated with or endorsed by Sensibull. Trading in derivatives carries risk. This tool
corrects display/analysis figures only — always verify against your broker's records before
making decisions.

## Keywords

Sensibull · Sensibull extension · Sensibull API · Sensibull option strategy builder · option
strategy builder · payoff graph · payoff chart accuracy · true entry price · off-grid entry price ·
exact entry price · 0.05 tick rounding · price step · stepper · cost basis · average fill price ·
large lot low premium · NHPC · options trading · derivatives · F&O · Nifty · Bank Nifty · options
analyzer · premium calculation · max profit loss · Chrome extension · Manifest V3 · React Redux
injection · content script · Zerodha · Kite · Indian stock market · NSE options · WebSocket ·
real-time data · data fetcher · Node.js · open source
