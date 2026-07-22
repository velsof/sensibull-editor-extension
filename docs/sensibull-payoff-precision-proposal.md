# Making the Payoff Graph Accurate at Real Fill Prices

**A proposal for Sensibull — precise per-leg entry prices in the Option Strategy Builder**

*Prepared by a Sensibull user, 2026-07-22. Based on live observation of
`web.sensibull.com/option-strategy-builder`.*

---

## Summary

The Strategy Builder rounds each leg's **entry price** to the `0.05` exchange tick. For
large-lot, low-premium instruments this rounding is a material fraction of the premium, so the
**Payoff Graph, Premium, and Max Profit/Loss are computed from a price the trader never actually
paid** — which is precisely the information the payoff graph exists to convey.

The good news: **your own analyzer engine already handles off-grid prices correctly.** Only the
*input/commit path* rounds. The fix is small and lives entirely inside Sensibull. This document
shows the problem with numbers, the evidence, and a minimal recommended change.

---

## The problem, with numbers

The payoff graph is the trader's core decision tool: it shows profit/loss at each underlying
price and date. Its accuracy depends entirely on each leg's entry price being correct.

Consider **NHPC** — lot size **6950**, premiums around ₹0.50–1.50. One tick of rounding is:

```
0.05 × 6950 = ₹347.50 of P&L per leg
```

A two-leg position can therefore be off by **₹500–700** purely from entry-price rounding — on a
position whose Max Profit may be only a few thousand rupees. A trader looking at the graph to
decide "am I in profit here?" is reading a curve drawn from the wrong cost basis.

Real fills make this worse: broker fills are frequently **averaged** across partial executions
(e.g. an actual average of `0.66`), which is inherently off the `0.05` grid. Zerodha reports
these average prices to the paisa. Sensibull rounds them away, so the trader currently rebuilds
the payoff in a spreadsheet to see the truth.

## Why this is an *analysis* problem, not an *order* problem

There are two distinct prices, and conflating them causes the issue:

| Price | Must respect the 0.05 tick? | Why |
|-------|-----------------------------|-----|
| **Order price** (what you send to the exchange) | **Yes** | Exchange rejects off-tick orders. |
| **Entry / cost-basis price** (what you actually paid) | **No** | It's a *record* of a fill, often an average; it can be any value. |

The Builder currently applies the order-price tick constraint to the entry/cost-basis price. For
analyzing a position you already hold, that constraint is simply wrong — the fill has already
happened at a precise price.

## Evidence: the engine already supports off-grid prices

Observed directly on the live builder (React + Redux):

1. **The payoff engine reads the committed per-leg `entryPrice` and nothing else.** Changing only
   the entry price shifts the whole payoff graph; no IV/Black-Scholes recomputation is needed for
   that shift.

2. **The shift is exactly linear.** Changing a leg's entry price by Δ moves P&L at every point by
   `±quantity × Δ`. Measured: lowering a 6950-qty BUY leg by `0.02` raised Max Profit by exactly
   **₹139** (`0.02 × 6950`).

3. **The engine accepts off-grid values with zero rounding.** When a precise entry price
   (`0.53`, `0.66`, `0.71`, …) is placed into the leg's state, the Premium and Max Profit/Loss
   recompute correctly to the paisa (e.g. a leg at `0.71` against a `1.28` short yields a net
   Premium of exactly `0.57`). The rounding to `0.05` happens only in the **input field's commit
   path**, not in the analyzer.

In other words: the capability is already there. The `0.05` rounding is an input-layer
constraint that shouldn't apply to the cost-basis price.

## What the browser extension does (proof of concept)

A small Chrome extension demonstrates the fix without any change to Sensibull:

- It reads the current strategy's legs from the builder's own state.
- It shows a compact panel with one editable **true entry price** per leg.
- When the trader enters a precise price, it commits that value into the leg's entry price using
  the **same state update your own UI performs** — no synthetic typing, no fake events.
- Every downstream number (payoff curves, Premium, Max Profit/Loss) recomputes automatically,
  because the analyzer already supports precise prices.
- Prices are remembered per instrument, so returning to a position restores its true cost basis.

This confirms the fix is purely about *letting a precise value reach the entry price* — the
analyzer does the rest.

## Recommended native implementation

Two changes, in order of value:

**1. Use the broker's actual average fill price for held positions.**
When a position is loaded from the broker, populate each leg's entry price with the broker's
reported **average traded price** (paisa precision), not a tick-rounded value. This makes the
payoff graph correct automatically for every existing position, with no extra UI. Zerodha and
most brokers already expose this field.

**2. Allow precise manual entry for the cost-basis price.**
Separate the two prices conceptually:
   - Keep the **order price** field tick-constrained (`0.05`) — orders must be valid.
   - Let the **entry / cost-basis price** accept any positive value (free-form input, not
     stepped/rounded). Optionally show a subtle, non-blocking note if it's off the `0.05` grid,
     so the trader knows it isn't an order-ready price.

Because the analyzer already consumes precise entry prices, this is primarily an input-layer
change: relax the rounding on the cost-basis field and (ideally) source it from the broker's
average fill.

## Why this matters for Sensibull

- **Correctness of the flagship feature.** The payoff graph is what users come for; today it is
  quietly inaccurate for a whole class of instruments (high-lot, low-premium).
- **Removes a spreadsheet workaround.** Users currently leave the product to compute accurate
  P&L elsewhere.
- **Low risk, small surface.** The computation engine is unchanged and already correct; only the
  entry-price input path is relaxed.

---

*Happy to share the proof-of-concept extension and the exact measurements behind the numbers
above.*
