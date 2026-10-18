// Phone back button support. The app swaps screens with state instead of URLs, so on a phone
// "back" used to leave the page (blank screen). Each open screen/sheet registers a "layer":
// opening pushes one history entry, pressing back closes the top layer, and closing a layer
// with the app's own buttons pops its entry again.
const { useEffect, useRef } = React;
const stack = [];
let ignore = 0;
let bound = false;

function bind() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("popstate", () => {
    if (ignore > 0) { ignore--; return; }
    const top = stack[stack.length - 1];
    if (top) { top.popped = true; top.close(); }
  });
}

export function useBackLayer(active, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    let ok = true;
    const layer = { popped: false, close: () => closeRef.current() };
    try { bind(); history.pushState({ ls: 1 }, ""); } catch (e) { ok = false; }
    if (!ok) return;
    stack.push(layer);
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
      if (!layer.popped) { ignore++; try { history.back(); } catch (e) { ignore--; } }
    };
  }, [active]);
}
