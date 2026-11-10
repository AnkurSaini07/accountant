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
  // Tests never touch the network: S2 tries to preload its web fonts, for example.
  settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true, disableIframePageLoading: true },
});
for (const [key, descriptor] of saved) if (descriptor) Object.defineProperty(globalThis, key, descriptor);

// happy-dom does no layout, so every element measures 0×0 and React Spectrum's virtualized
// collections (Picker, ComboBox, TableView…) render only one row. Give elements a size, as the
// React Spectrum testing docs recommend.
for (const prop of ["clientWidth", "clientHeight"] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 1000 });
}

// Imported only now: Testing Library binds `screen` to the global document when it is first loaded,
// so a static import (evaluated before register() above) would leave it with no document.
const { default: _default, ...matchers } = await import("@testing-library/jest-dom/matchers");
const { cleanup } = await import("@testing-library/react");

expect.extend(matchers);
// Testing Library only auto-cleans up when test hooks are globals, which they aren't in bun:test.
afterEach(cleanup);
