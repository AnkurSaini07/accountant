import index from "../web/index.html";
import { app } from "./app.ts";

export const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/*": app.fetch,
    // Every other path serves the React app; client-side routing takes it from there.
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`Server listening on ${server.url}`);
