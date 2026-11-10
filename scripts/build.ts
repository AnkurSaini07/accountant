// Production build of the web app: `bun run build` → dist/
import { s2Plugin } from "./s2-plugin.ts";

const outdir = process.argv[2] ?? "dist";
const result = await Bun.build({
  entrypoints: ["src/web/index.html"],
  outdir,
  minify: true,
  sourcemap: "linked",
  plugins: [s2Plugin],
  throw: false,
});
for (const log of result.logs) console.error(String(log));
if (!result.success) process.exit(1);
for (const o of result.outputs) console.log(`${o.kind.padEnd(10)} ${(o.size / 1024).toFixed(1).padStart(8)} KB  ${o.path.replace(process.cwd() + "/", "")}`);
