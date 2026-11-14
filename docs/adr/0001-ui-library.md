# ADR 0001: UI library — React Spectrum S2 on Bun

**Status:** Superseded by [ADR 0002](./0002-primer.md) (2026-11-12) · **Date:** 2026-11-10 · **Issue:** #3

## Decision

Use **React Spectrum S2** (`@react-spectrum/s2`, the latest React Spectrum), including its `style()` macro.
We don't need the v3 fallback (`@adobe/react-spectrum`).

S2 doesn't work with Bun out of the box. A small bundler plugin of ours, `scripts/s2-plugin.ts`, closes the
gap. It is registered for both build paths:

| Path | Where |
|---|---|
| Dev server (`Bun.serve` HTML imports, HMR) | `bunfig.toml` → `[serve.static] plugins` |
| Production build (`bun run build` → `dist/`) | `scripts/build.ts` → `Bun.build({ plugins })` |

## What we found

1. **Bun's built-in macros can't run S2's `style()` macro.** Bun supports `with { type: "macro" }`, but it resolves
   `@react-spectrum/s2/style` with browser conditions (the export is node-only), and the macro emits its CSS
   through `this.addAsset()`, a Parcel macro API Bun doesn't provide.
2. **`unplugin-parcel-macros` doesn't work under Bun as published (0.2.0).** Its esbuild adapter builds file ids as
   `args.path + args.suffix`, and Bun doesn't set `suffix`, so every file silently fails its `.tsx` check. Its module
   loader also uses Node internals (`Module.prototype.load`). Our plugin calls the package's native `transform()`
   directly and loads macros with `import()`. That's about 60 lines, and it's the only part we depend on, so the
   version is pinned exactly.
3. **Bun's CSS parser rejects `:active-view-transition-type()`**, which is used in S2's Toast and SideNav CSS. The
   plugin rewrites it to `:is(.type)` class selectors. S2 already sets those classes on `<html>` for Safari, so
   Toast is unaffected; at worst a SideNav view-transition animation is plainer.
4. **Import components from their own entry points**, e.g. `@react-spectrum/s2/Button`, not `@react-spectrum/s2`.
   The main index pulls in every component's CSS: 783 KB vs 145 KB minified for the same page. JS is the same
   (~615 KB minified, mostly React Aria).
5. **`Heading` is only styled inside S2 containers** (Dialog, etc.). For page titles use the macro's type tokens:
   `style({ font: "heading-xl" })`.
6. **Fonts load from Adobe Fonts (Typekit) at runtime.** Text can be invisible for up to ~3 s on a cold, slow load
   while the font downloads, then falls back to a system font if the CDN can't be reached. If the factory PCs
   are often offline, revisit (self-hosting needs a licence check).

## How to use it

```tsx
import { Button } from "@react-spectrum/s2/Button";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

const toolbar = style({ display: "flex", gap: 8, padding: 16 });
<div className={toolbar}><Button variant="accent">Save</Button></div>
```

- Style our own elements with `style()` only. It is type-checked against Spectrum tokens, so a wrong value is a
  compile error. Don't use hand-written CSS for things the macro covers.
- After editing a macro's own source (not a file that *uses* `style()`), restart the dev server. Macros are
  loaded once per process.

## Consequences

- We own `scripts/s2-plugin.ts`. `scripts/s2-plugin.test.ts` builds a file with the macro on every CI run, so an
  S2, plugin or Bun upgrade that breaks it fails loudly.
- When upgrading `unplugin-parcel-macros` or Bun, re-check findings 1–3. If upstream fixes them, delete the
  matching part of the plugin.
