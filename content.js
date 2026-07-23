(() => {
  "use strict";

  const STORAGE_KEY = "truePrices";
  const PANEL_ID = "sbl-trueprice-panel";
  let legsCache = [];
  let currentSymbol = null;
  let store = { truePrices: {} };
  let lastRenderSig = null;

  // ---- storage ----
  function loadStore() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({ [STORAGE_KEY]: {} }, (res) => {
          store.truePrices = res[STORAGE_KEY] || {};
          resolve();
        });
      } catch (e) { resolve(); }
    });
  }
  function saveTruePrice(symbol, token, price) {
    if (!store.truePrices[symbol]) store.truePrices[symbol] = {};
    store.truePrices[symbol][String(token)] = price;
    try { chrome.storage.local.set({ [STORAGE_KEY]: store.truePrices }); } catch (e) {}
  }
  function storedPrice(symbol, token) {
    const s = store.truePrices[symbol];
    return s ? s[String(token)] : undefined;
  }

  // ---- inject page-world bridge ----
  function injectBridge() {
    if (document.getElementById("sbl-injected-tag")) return;
    const s = document.createElement("script");
    s.id = "sbl-injected-tag";
    s.src = chrome.runtime.getURL("injected.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- bridge messaging ----
  function postToPage(msg) {
    window.postMessage(Object.assign({ source: "sbl-content" }, msg), "*");
  }
  function requestLegs() { postToPage({ type: "READ_LEGS" }); }
  function setPrice(token, price) {
    postToPage({ type: "SET_PRICE", instrumentToken: token, entryPrice: price });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.source !== "sbl-page") return;
    if (d.type === "READY") { requestLegs(); }
    else if (d.type === "LEGS") { onLegs(d.legs); }
    else if (d.type === "PRICE_SET") { onPriceSet(d.instrumentToken, d.entryPrice); }
  });

  // ---- react to legs ----
  function onLegs(legs) {
    if (!Array.isArray(legs) || !legs.length) { removePanel(); legsCache = []; return; }
    const symbol = legs[0].instrumentSymbol;
    legsCache = legs;
    currentSymbol = symbol;
    renderPanel(legs);
    // re-apply stored true prices for this instrument
    legs.forEach((leg) => {
      const sp = storedPrice(symbol, leg.instrumentToken);
      if (sp !== undefined && sp !== leg.entryPrice) setPrice(leg.instrumentToken, sp);
    });
  }
  function onPriceSet(token, price) {
    const input = document.querySelector(
      `#${PANEL_ID} input[data-token="${token}"]`);
    if (input && document.activeElement !== input) input.value = String(price);
  }

  // ---- panel ----
  function removePanel() {
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    lastRenderSig = null;
  }
  function anchorNode() {
    // Insert near the leg list. Return null (NOT document.body) when the anchor
    // isn't in the DOM yet: the strategy card's footer ("Multiplier" row) can mount
    // a tick after the legs are available in Redux. Falling back to body would drop
    // the panel at the top of the page, behind Sensibull's fixed top bar, and the
    // signature guard would then strand it there permanently. Returning null makes
    // renderPanel skip this pass; the MutationObserver retries once the footer mounts.
    const paras = document.querySelectorAll("p");
    for (const el of paras) {
      if (el.textContent && el.textContent.trim() === "Multiplier") {
        const row = el.parentElement && el.parentElement.parentElement;
        if (row && row.parentElement) return row.parentElement;
      }
    }
    return null;
  }
  function renderPanel(legs) {
    const sig = legs.map((l) => l.instrumentToken + ":" + l.strike + ":" + l.action + ":" + l.quantity).join("|");

    // No valid anchor yet (footer not mounted) — skip this pass rather than dropping
    // the panel into document.body behind the top bar. The observer will retry.
    const anchor = anchorNode();
    if (!anchor) return;

    let panel = document.getElementById(PANEL_ID);
    // Misplaced means the panel got stranded somewhere other than the current anchor
    // (e.g. an earlier fallback, or a Sensibull re-render that moved the subtree). It
    // must be re-anchored even when the leg signature is unchanged — this is the
    // recovery path for the "panel stuck at the top of the page" bug.
    const misplaced = panel && panel.parentElement !== anchor;

    // Skip rebuild if the leg set is unchanged AND the panel is correctly placed
    // (prevents the observer feedback loop), or if the user is currently editing a
    // field in the panel (prevents lost keystrokes / lost focus).
    if (panel) {
      const focused = document.activeElement;
      const editingHere = focused && panel.contains(focused);
      if (editingHere) return;
      if (sig === lastRenderSig && !misplaced) return;
    }
    lastRenderSig = sig;

    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.style.cssText =
        "margin:8px 0;padding:8px 10px;border:1px solid #cfd4dc;border-radius:6px;" +
        "background:#fbfcfe;font-family:inherit;font-size:12px;color:#333;";
    }
    // Only (re)insert when the parent is wrong. Don't force first-child position on
    // every pass — fighting React over child order would re-trigger the observer loop.
    if (panel.parentElement !== anchor) {
      anchor.insertBefore(panel, anchor.firstChild);
    }
    panel.innerHTML = "";
    const title = document.createElement("div");
    title.textContent = "True entry price (chart accuracy)";
    title.style.cssText = "font-weight:600;margin-bottom:6px;color:#1a1a1a;";
    panel.appendChild(title);

    legs.forEach((leg) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:3px 0;";

      const label = document.createElement("span");
      label.style.cssText = "flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      const side = leg.action === "SELL" ? "SELL" : "BUY";
      label.textContent = `${leg.instrumentSymbol} ${leg.strike}${leg.instrumentType || ""} · ${side} · ${leg.quantity}`;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "0.01";
      input.setAttribute("data-token", String(leg.instrumentToken));
      const sp = storedPrice(leg.instrumentSymbol, leg.instrumentToken);
      input.value = String(sp !== undefined ? sp : leg.entryPrice);
      input.style.cssText =
        "width:76px;padding:2px 6px;border:1px solid #cfd4dc;border-radius:4px;" +
        "font-size:12px;text-align:right;background:#fff;color:inherit;";

      const commit = () => {
        const v = parseFloat(input.value);
        if (v > 0) {
          saveTruePrice(leg.instrumentSymbol, leg.instrumentToken, v);
          setPrice(leg.instrumentToken, v);
        } else {
          input.value = String(storedPrice(leg.instrumentSymbol, leg.instrumentToken)
            ?? leg.entryPrice);
        }
      };
      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);

      row.appendChild(label);
      row.appendChild(input);
      panel.appendChild(row);
    });
  }

  // ---- keep alive across React re-renders / SPA nav ----
  let debounce = null;
  function schedule() {
    if (debounce) return;
    debounce = setTimeout(() => { debounce = null; requestLegs(); }, 150);
  }

  function start() {
    injectBridge();
    requestLegs();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  loadStore().then(start);
})();
