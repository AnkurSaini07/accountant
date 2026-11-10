import { app } from "./app.ts";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/*": app.fetch,
  },
  fetch: () => new Response("Not found", { status: 404 }),
});

console.log(`Server listening on ${server.url}`);
