import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { rewriteViewTransitionTypes, s2Plugin } from "./s2-plugin.ts";

describe("rewriteViewTransitionTypes", () => {
  test("turns view-transition types into class selectors", () => {
    expect(rewriteViewTransitionTypes(":root:active-view-transition-type(a, b)::view-transition-old(root) {}")).toBe(
      ":root:is(.a, .b)::view-transition-old(root) {}",
    );
    expect(rewriteViewTransitionTypes(":is(html.t-add, html:active-view-transition-type(t-add)) {}")).toBe(
      ":is(html.t-add, html:is(.t-add)) {}",
    );
  });

  test("leaves other CSS alone", () => {
    const css = ".a:hover, :is(.b) { color: red }";
    expect(rewriteViewTransitionTypes(css)).toBe(css);
  });
});

describe("s2Plugin with Bun.build", () => {
  // Inside the repo (not /tmp) so @react-spectrum/s2 resolves from our node_modules.
  const dir = join(import.meta.dir, ".s2-plugin-test");

  beforeAll(async () => {
    await mkdir(dir, { recursive: true });
    await Bun.write(
      join(dir, "entry.tsx"),
      `import { style } from "@react-spectrum/s2/style" with { type: "macro" };
       export const cls = style({ display: "flex", gap: 16 });`,
    );
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  test("runs the style macro and emits its CSS", async () => {
    const result = await Bun.build({ entrypoints: [join(dir, "entry.tsx")], plugins: [s2Plugin], throw: false });
    expect(result.logs.map(String)).toEqual([]);
    expect(result.success).toBe(true);

    const js = await result.outputs.find((o) => o.kind === "entry-point")!.text();
    const css = await result.outputs.find((o) => o.path.endsWith(".css"))!.text();
    expect(js).not.toContain("@react-spectrum/s2/style"); // macro import replaced at build time
    expect(css).toContain("display: flex");
    expect(css).toMatch(/gap: 1rem|gap: 16px/);
  });

  test("reports a missing macro export as a build error", async () => {
    await Bun.write(join(dir, "bad.tsx"), `import { nope } from "@react-spectrum/s2/style" with { type: "macro" }; export const x = nope();`);
    const result = await Bun.build({ entrypoints: [join(dir, "bad.tsx")], plugins: [s2Plugin], throw: false });
    expect(result.success).toBe(false);
    expect(result.logs.map(String).join("\n")).toContain("nope");
  });
});
