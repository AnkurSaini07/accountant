// `bun test` preload (bunfig.toml): gives web component tests a DOM via happy-dom.
//
// happy-dom replaces nearly every global, including fetch/Request/Response/URL. Server code (Hono) and
// server tests need Bun's own versions, so we put those back after registering. Component tests that
// call the API mock `fetch` explicitly instead of relying on happy-dom's.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect } from "bun:test";

const BUN_GLOBALS = [
  "fetch", "Request", "Response", "Headers", "FormData", "Blob", "File", "URL", "URLSearchParams",
  "ReadableStream", "WritableStream", "TransformStream", "AbortController", "AbortSignal",
  "TextEncoder", "TextDecoder", "WebSocket", "crypto", "structuredClone",
] as const;

const saved = BUN_GLOBALS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
GlobalRegistrator.register({
  url: "http://localhost:3000/",
  // Tests never touch the network.
  settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true, disableIframePageLoading: true },
});
for (const [key, descriptor] of saved) if (descriptor) Object.defineProperty(globalThis, key, descriptor);

// happy-dom has the popover attribute but not the Popover API that Primer's tooltips call on focus.
// Tests never look at tooltips, so no-ops do (Primer's own polyfill loops forever under happy-dom).
for (const name of ["showPopover", "hidePopover", "togglePopover"] as const) {
  if (!(name in HTMLElement.prototype)) Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value() {} });
}

// Imported only now: Testing Library binds `screen` to the global document when it is first loaded,
// so a static import (evaluated before register() above) would leave it with no document.
const { default: _default, ...matchers } = await import("@testing-library/jest-dom/matchers");
const { cleanup } = await import("@testing-library/react");

expect.extend(matchers);
// Testing Library only auto-cleans up when test hooks are globals, which they aren't in bun:test.
// Primer's dialogs and menus portal into a root it adds to <body>, which cleanup() leaves behind: a
// dialog still open when a test ends would otherwise show up in the next test.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

// Component tests fake the API with fakeApi(); put Bun's fetch back after each one.
const { restoreFetch } = await import("./fake-api.ts");
afterEach(restoreFetch);
