import { expect, test } from "bun:test";
import { clampInt } from "./NumberField.tsx";

test("clampInt snaps into range and falls back on junk", () => {
  expect(clampInt("5", 42, 999, 42)).toBe(42);
  expect(clampInt("143", 1, 999, 1)).toBe(143);
  expect(clampInt("12", 1, 8, 4)).toBe(8);
  expect(clampInt("", 1, 8, 4)).toBe(4);
});
