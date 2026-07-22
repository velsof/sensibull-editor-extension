# CLAUDE.md — Sensibull True-Price Injector

Guidance for Claude Code (and humans) working in this repo. Keep it current.

## What this is

A Chrome **Manifest V3** extension that makes Sensibull's Option Strategy Builder payoff chart
accurate. Sensibull rounds each leg's entry price to the `0.05` exchange tick; for large-lot,
low-premium instruments (e.g. NHPC, lot 6950 → `0.05 × 6950 = ₹347.50`/leg) that makes the payoff
graph, premium, and max P&L wrong. This extension injects the user's **true off-grid entry price**
straight into Sensibull's Redux store so everything recomputes from the real cost basis.

**Analysis-only.** It never places, modifies, or submits an order. Do not add order-placing
behaviour.

## Architecture

- **No build step.** Vanilla JS, loaded as unpacked. Do not introduce a bundler/framework.
- `manifest.json` — MV3; `storage` permission only; `injected.js` under `web_accessible_resources`.
- `content.js` — **isolated world**: injects the bridge, renders the per-leg panel, owns
  `chrome.storage.local` persistence, relays `postMessage`, survives re-renders via a debounced
  `MutationObserver`.
- `injected.js` — **page world**: finds the Redux store, reads legs, dispatches entry-price updates.
  Injected because a content script's isolated world cannot reach the page's JS heap (Redux store).
- Bridge protocol over `window.postMessage`: content tags messages `source:"sbl-content"`, page
  tags `source:"sbl-page"`. Types: `READY`, `READ_LEGS`/`LEGS`, `SET_PRICE`/`PRICE_SET`.

## Hard-won facts (verified live — don't re-derive)

- **Store discovery:** fiber walk from `#root` (`__reactContainer$`/`__reactFiber$` key) to the
  first fiber whose `memoizedProps.store` is a Redux store; it's the react-redux `<Provider>`.
- **The one action that works:** `dispatch({ type: 'builder/changeStrategyLegEntryPrice',
  payload: { instrumentToken, entryPrice } })`. Alone sufficient, honours off-grid values with
  **zero rounding**, triggers full payoff recompute.
- **Async settle:** the analyzer slice (`strategyAnalyzers.builder.instances[<key>].legs`) updates
  on the **next tick**. `getState()` in the same tick returns stale data — always verify via
  `setTimeout(…, 0)` before echoing `PRICE_SET`. A stale read here is NOT an injection bug.
- **Linearity:** changing a leg's entry price by Δ shifts P&L everywhere by `±quantity × Δ`
  (measured: Δ0.02 × 6950 = ₹139 exactly).
- **Rounding lives only in the input commit path**, never in the analyzer engine.

## Landmines

- **renderPanel feedback loop:** the panel lives inside the `MutationObserver`'s observed subtree.
  Rebuilding it on every `LEGS` message re-triggers the observer → runaway loop that also destroys
  a focused input. `renderPanel` MUST keep its idempotence guard: skip rebuild when the leg-identity
  signature (token/strike/action/quantity, **excluding entryPrice**) is unchanged, and skip while a
  panel input is focused. `removePanel` resets the signature.
- **CSP:** the bridge is injected as `<script src="chrome-extension://…/injected.js">`. Verified in
  logic but not under Sensibull's live CSP in-browser. If ever blocked, fallback is to inline the
  bridge source into the tag's `textContent`.

## Development workflow

- **Standing directive: implement using Sonnet, review using Opus.** Sonnet subagents implement;
  Opus (main session) reviews.
- Superpowers flow used to build this: brainstorming → writing-plans → subagent-driven-development;
  systematic-debugging for bugs. Internal specs/plans/reports live in `docs/superpowers/` and are
  **git-ignored** (not for the public repo). `docs/sensibull-payoff-precision-proposal.md` (the
  proposal to Sensibull) IS committed.
- Verification is done live via Playwright against the authenticated builder. When recording demos,
  use a dummy strategy — the panel exposes real positions and P&L.

## Repo

- Public: https://github.com/velsof/sensibull-editor-extension — MIT © Velocity Software Solutions.
- Commit only when asked; never force-push `main` (it carries the upstream LICENSE + history).
