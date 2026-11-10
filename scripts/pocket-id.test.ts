import { expect, test } from "bun:test";
import { assetName, checksumFor } from "./pocket-id.ts";

const hash = "a".repeat(64);
const sums = `${"b".repeat(64)}  pocket-id_linux_amd64\n${hash}  pocket-id_darwin_arm64\n`;

test("checksumFor finds the matching file", () => {
  expect(checksumFor(sums, "pocket-id_darwin_arm64")).toBe(hash);
});

test("checksumFor rejects missing or malformed entries", () => {
  expect(() => checksumFor(sums, "pocket-id_darwin_amd64")).toThrow();
  expect(() => checksumFor("xyz  pocket-id_darwin_arm64", "pocket-id_darwin_arm64")).toThrow();
});

test("assetName maps platform/arch to release asset", () => {
  expect(assetName("darwin", "arm64")).toBe("pocket-id_darwin_arm64");
  expect(assetName("linux", "x64")).toBe("pocket-id_linux_amd64");
  expect(assetName("win32", "x64")).toBe("pocket-id_windows_amd64.exe");
  expect(() => assetName("aix", "ppc")).toThrow();
});
