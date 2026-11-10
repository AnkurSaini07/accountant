// Bun bundler plugin that makes React Spectrum S2 work with Bun (Bun.build and the Bun.serve dev server).
//
// 1. Runs S2's `style()` macro (`import { style } from "@react-spectrum/s2/style" with { type: "macro" }`).
//    Bun's built-in macros can't run it: it emits CSS through `this.addAsset()`, a Parcel macro API.
//    We call the native transform from unplugin-parcel-macros directly, because that package's
//    unplugin/esbuild adapter relies on Node internals and esbuild-only plugin fields Bun lacks.
// 2. Rewrites `:active-view-transition-type(a, b)` in S2's prebuilt CSS to `:is(.a, .b)`. Bun's CSS
//    parser rejects that pseudo-class. S2 already falls back to classes on <html> for browsers without
//    it (Safari), so this keeps Toast working; at worst a SideNav view-transition animation is plainer.
//
// ponytail: macros are imported once per process; editing a macro's own source needs a dev server restart.
import type { BunPlugin } from "bun";
import { createHash } from "node:crypto";
import { dirname, extname } from "node:path";
// Deep import: the package only exposes this through its internal "#native" subpath.
import { transform } from "unplugin-parcel-macros/index.js";

const MACRO_ATTR = /with\s*\{\s*type:\s*['"]macro['"]\s*\}/;
// Values of the native `Type` const enum (JS, JSX, TS, TSX); ambient const enums can't be imported under isolatedModules.
const TYPES: Record<string, number> = { ".js": 0, ".jsx": 1, ".ts": 2, ".tsx": 3 };
const LOADERS = { ".js": "js", ".jsx": "jsx", ".ts": "ts", ".tsx": "tsx" } as const;
const NAMESPACE = "s2-macro-css";

/** `:active-view-transition-type(a, b)` → `:is(.a, .b)`. Exported for tests. */
export function rewriteViewTransitionTypes(css: string): string {
  return css.replace(/:active-view-transition-type\(([^)]*)\)/g, (_, types: string) =>
    `:is(${types.split(",").map((t) => `.${t.trim()}`).join(", ")})`,
  );
}

type MacroAsset = { type: string; content: string };
type MacroError = { kind: 1 | 2; message: string }; // 1 = failed to load the macro, 2 = macro threw

export const s2Plugin: BunPlugin = {
  name: "react-spectrum-s2",
  setup(build) {
    const css = new Map<string, string>(); // virtual module id -> CSS emitted by a macro

    build.onLoad({ filter: /@react-spectrum[\\/]s2[\\/].*\.css$/ }, async (args) => ({
      contents: rewriteViewTransitionTypes(await Bun.file(args.path).text()),
      loader: "css",
    }));

    build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
      const ext = extname(args.path) as keyof typeof LOADERS;
      const code = await Bun.file(args.path).text();
      const loader = LOADERS[ext];
      if (args.path.includes("/node_modules/") || !MACRO_ATTR.test(code)) return { contents: code, loader };

      const imports: string[] = [];
      const result = (await transform(TYPES[ext]!, args.path, code, async (_err: unknown, src: string, exportName: string, macroArgs: unknown[], loc: unknown) => {
        let fn: unknown;
        try {
          fn = (await import(Bun.resolveSync(src, dirname(args.path))))[exportName];
        } catch (err) {
          throw { kind: 1, message: `Cannot load macro "${exportName}" from "${src}": ${(err as Error).message}` } satisfies MacroError;
        }
        if (typeof fn !== "function") throw { kind: 1, message: `"${exportName}" in "${src}" is not a function` } satisfies MacroError;
        const assets: MacroAsset[] = [];
        try {
          const value = fn.apply({ loc, addAsset: (a: MacroAsset) => assets.push(a), invalidateOnFileChange() {} }, macroArgs);
          for (const asset of assets) {
            const id = `${createHash("sha256").update(asset.content).digest("hex")}.${asset.type}`;
            css.set(id, asset.content);
            imports.push(`import "${NAMESPACE}:${id}";`);
          }
          return value;
        } catch (err) {
          throw { kind: 2, message: (err as Error).stack ?? String(err) } satisfies MacroError;
        }
      })) as { code: string };

      return { contents: `${result.code}\n${imports.join("\n")}`, loader };
    });

    build.onResolve({ filter: new RegExp(`^${NAMESPACE}:`) }, (args) => ({ path: args.path.slice(NAMESPACE.length + 1), namespace: NAMESPACE }));
    build.onLoad({ filter: /.*/, namespace: NAMESPACE }, (args) => {
      const contents = css.get(args.path);
      if (contents === undefined) throw new Error(`Unknown macro CSS module ${args.path}`);
      return { contents, loader: "css" };
    });
  },
};

export default s2Plugin;
