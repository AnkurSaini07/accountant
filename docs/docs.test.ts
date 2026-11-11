// Keeps the operator docs in step with the code: every env var the server reads is documented, the
// documented Pocket ID groups are the app's roles, and links between docs (incl. #anchors) resolve.
import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { ROLES } from "../src/server/auth/oidc.ts";

const root = join(import.meta.dir, "..");
const read = (path: string) => Bun.file(join(root, path)).text();
const DOCS = ["docs/AUTH.md", "docs/OPERATIONS.md"];
const docs = Object.fromEntries(await Promise.all(DOCS.map(async (p) => [p, await read(p)] as const)));
const allDocs = Object.values(docs).join("\n");

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces → "-". */
const slug = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
const anchors = (md: string) => new Set([...md.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1]!)));

describe("operator docs", () => {
  test("document every environment variable the server reads", async () => {
    const glob = new Bun.Glob("{src/server,scripts}/**/*.ts");
    const used = new Set<string>();
    for await (const file of glob.scan(root)) {
      if (file.includes(".test.")) continue;
      for (const [, name] of (await read(file)).matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)) used.add(name!);
    }
    for (const [, name] of (await read(".env.example")).matchAll(/^([A-Z][A-Z0-9_]+)=/gm)) used.add(name!);
    used.delete("POCKET_ID_ENCRYPTION_KEY"); // dev compose name; production docs use the same name
    expect(used.size).toBeGreaterThan(5);
    const missing = [...used].filter((name) => !allDocs.includes(name));
    expect(missing).toEqual([]);
  });

  test("list exactly the app's roles as Pocket ID groups", () => {
    const groups = new Set([...docs["docs/AUTH.md"]!.matchAll(/`(accountant-[a-z]+)`/g)].map((m) => m[1]));
    expect([...groups].sort()).toEqual(ROLES.map((r) => `accountant-${r}`).sort());
  });

  test("links to other files and #sections resolve", async () => {
    const broken: string[] = [];
    for (const [path, md] of Object.entries(docs)) {
      for (const [, target] of md.matchAll(/\]\((?!https?:)([^)\s]+)\)/g)) {
        const [file, hash] = target!.split("#") as [string, string | undefined];
        const resolved = file ? join(dirname(path), file) : path;
        const exists = await Bun.file(join(root, resolved)).exists();
        if (!exists || (hash && !anchors(await read(resolved)).has(hash))) broken.push(`${path} → ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
