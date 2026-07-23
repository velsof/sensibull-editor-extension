# Changelog

All notable changes to the Sensibull True-Price Injector are documented here.
The format is loosely based on [Keep a Changelog](https://keepachangelog.com/);
this project uses the extension's `manifest.json` version.

## [2.0.1] — 2026-07-23

### Fixed
- **Panel rendered at the top of the page, hidden behind Sensibull's fixed top bar**
  instead of above the strategy card. The panel is anchored by locating the strategy
  card's "Multiplier" footer row, which mounts a tick *after* the legs become readable
  in Redux. When that row was not yet present, the anchor logic fell back to
  `document.body` and inserted the panel as the page's first child — behind the top bar —
  and the render guard then stranded it there permanently.
  - The anchor lookup now skips the pass (rather than falling back to `document.body`)
    when the footer isn't mounted yet; the `MutationObserver` retries once it is.
  - A stranded panel now re-anchors itself on the next tick instead of staying stuck.

## [2.0.0] — 2026-07-22

### Changed
- Rewrote the extension to inject the true off-grid entry price directly into Sensibull's
  Redux store, so the payoff chart, Premium, and Max Profit/Loss recompute from the real
  cost basis. Replaces the earlier DOM `step`-attribute approach, which never reached the
  payoff engine.

### Fixed
- Eliminated a `renderPanel` rebuild loop where wiping the panel on every legs update
  re-triggered the `MutationObserver` (~7×/sec) and destroyed a focused input mid-edit.
  Added a leg-identity signature guard and a focus check.
