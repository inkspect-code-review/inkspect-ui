import { parseHTML } from "linkedom";

// Portals choose their browser effects when the component modules are loaded.
const { window, document } = parseHTML("<html><head></head><body></body></html>");
Object.assign(globalThis, {
  window, document, self: window, location: new URL("https://example.test/dashboard"),
  HTMLElement: window.HTMLElement, Node: window.Node, CustomEvent: window.CustomEvent,
  MutationObserver: window.MutationObserver, getComputedStyle: (element: HTMLElement) => element.style,
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0),
  cancelAnimationFrame: clearTimeout,
  IS_REACT_ACT_ENVIRONMENT: true,
});
