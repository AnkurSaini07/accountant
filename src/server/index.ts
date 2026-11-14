import index from "../web/index.html";
import { app } from "./app.ts";

export const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/*": app.fetch,
    // Every other path serves the React app; client-side routing takes it from there.
    "/*": index,
  },
  // ponytail: no HMR. Bun 1.4.4's HMR bundler drops CSS-module imports (`import c from "./x.module.css"`
  // → ReferenceError at load, blank page), so edits need a browser reload. Turn it back on once a Bun
  // release passes scripts/dev-css-modules.test.ts with hmr: true.
  development: process.env.NODE_ENV !== "production" && { hmr: false, console: true },
});

console.log(`Server listening on ${server.url}`);
