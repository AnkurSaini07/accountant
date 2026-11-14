// The dev server (src/server/index.ts) runs with hmr: false because Bun's HMR bundler drops CSS-module
// imports: the page then dies at load with "import_layout_module is not defined". Both cases bundle the
// real app through Bun.serve and look for a class name that only a working CSS-module import produces.
import { expect, test } from "bun:test";
import index from "../src/web/index.html";

async function devBundle(hmr: boolean) {
  const server = Bun.serve({ port: 0, routes: { "/": index }, development: { hmr, console: false } });
  try {
    const html = await (await fetch(server.url)).text();
    const src = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
    if (!src) throw new Error(`no script in the dev page:\n${html.slice(0, 500)}`);
    return await (await fetch(new URL(src, server.url))).text();
  } finally {
    server.stop(true);
  }
}

// Panel.module.css's `.panel` becomes `panel_<hash>` once its import survives bundling.
const hasPanelClass = (js: string) => /["'`]panel_[\w-]+/.test(js);

test("without HMR (how the dev server runs), CSS modules reach the browser", async () => {
  expect(hasPanelClass(await devBundle(false))).toBe(true);
}, 60_000);

// Fails today, as expected. When a Bun upgrade makes it pass, bun test reports it: turn hmr back on in
// src/server/index.ts and delete this case.
test.failing("with HMR, Bun 1.4.4 drops CSS-module imports", async () => {
  expect(hasPanelClass(await devBundle(true))).toBe(true);
}, 60_000);
