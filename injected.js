(() => {
  "use strict";

  const isStore = (o) =>
    o && typeof o.getState === "function" &&
    typeof o.dispatch === "function" && typeof o.subscribe === "function";

  let cachedStore = null;

  function findStore() {
    if (cachedStore) return cachedStore;
    const roots = [document.getElementById("root"), document.body,
      ...document.querySelectorAll("div")].filter(Boolean);
    for (const el of roots.slice(0, 50)) {
      const key = Object.keys(el).find(
        (k) => k.startsWith("__reactContainer$") || k.startsWith("__reactFiber$"));
      if (!key) continue;
      const seen = new Set();
      const stack = [el[key]];
      let guard = 0;
      while (stack.length && guard++ < 20000) {
        const f = stack.pop();
        if (!f || seen.has(f)) continue;
        seen.add(f);
        const mp = f.memoizedProps;
        if (mp && isStore(mp.store)) { cachedStore = mp.store; return cachedStore; }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
        if (f.return) stack.push(f.return);
      }
    }
    return null;
  }

  function legsInstance(state) {
    const inst = state && state.strategyAnalyzers &&
      state.strategyAnalyzers.builder && state.strategyAnalyzers.builder.instances;
    if (!inst) return null;
    for (const k of Object.keys(inst)) {
      if (Array.isArray(inst[k].legs) && inst[k].legs.length) return inst[k];
    }
    return null;
  }

  function readLegs() {
    const store = findStore();
    if (!store) return null;
    const instance = legsInstance(store.getState());
    if (!instance) return [];
    return instance.legs.map((l) => ({
      instrumentToken: l.instrumentToken,
      instrumentSymbol: l.instrumentSymbol,
      action: l.action,
      quantity: l.quantity,
      lotSize: l.lotSize,
      strike: l.strike,
      entryPrice: l.entryPrice,
    }));
  }

  function post(msg) {
    window.postMessage(Object.assign({ source: "sbl-page" }, msg), "*");
  }

  function handleSetPrice(instrumentToken, entryPrice) {
    const store = findStore();
    if (!store) return;
    store.dispatch({
      type: "builder/changeStrategyLegEntryPrice",
      payload: { instrumentToken, entryPrice },
    });
    // analyzer slice settles on the next tick; verify then echo the committed value
    setTimeout(() => {
      const instance = legsInstance(store.getState());
      const leg = instance && instance.legs.find((l) => l.instrumentToken === instrumentToken);
      post({ type: "PRICE_SET", instrumentToken,
        entryPrice: leg ? leg.entryPrice : entryPrice });
    }, 0);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.source !== "sbl-content") return;
    if (d.type === "READ_LEGS") {
      const legs = readLegs();
      if (legs === null) { setTimeout(() => post({ type: "LEGS", legs: readLegs() || [] }), 300); }
      else post({ type: "LEGS", legs });
    } else if (d.type === "SET_PRICE") {
      handleSetPrice(d.instrumentToken, d.entryPrice);
    }
  });

  post({ type: "READY" });
})();
