// Runs a local Pocket ID (OIDC provider) for development: `bun run auth:dev`.
// Downloads a pinned release binary into .pocket-id/, verifies its SHA-256, and starts it on :1411.
import { $ } from "bun";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const VERSION = "2.19.2";
const PORT = 1411;
const DIR = join(import.meta.dir, "..", ".pocket-id");

/** Finds the SHA-256 for `name` in a goreleaser-style checksums.txt (`<hash>  <name>` per line). */
export function checksumFor(checksums: string, name: string): string {
  for (const line of checksums.split("\n")) {
    const [hash, file] = line.trim().split(/\s+/);
    if (file === name && hash && /^[0-9a-f]{64}$/.test(hash)) return hash;
  }
  throw new Error(`No checksum for ${name}`);
}

export function assetName(platform = process.platform, arch = process.arch): string {
  const os = { darwin: "darwin", linux: "linux", win32: "windows" }[platform as string];
  const cpu = { arm64: "arm64", x64: "amd64" }[arch as string];
  if (!os || !cpu) throw new Error(`Unsupported platform ${platform}/${arch}`);
  return `pocket-id_${os}_${cpu}${os === "windows" ? ".exe" : ""}`;
}

async function download(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res;
}

async function ensureBinary(): Promise<string> {
  const name = assetName();
  const bin = join(DIR, `${name}-${VERSION}`);
  if (await Bun.file(bin).exists()) return bin;

  const base = `https://github.com/pocket-id/pocket-id/releases/download/v${VERSION}`;
  console.log(`Downloading Pocket ID v${VERSION} (${name})…`);
  const [checksums, binary] = await Promise.all([
    download(`${base}/checksums.txt`).then((r) => r.text()),
    download(`${base}/${name}`).then((r) => r.arrayBuffer()),
  ]);
  const actual = new Bun.CryptoHasher("sha256").update(binary).digest("hex");
  if (actual !== checksumFor(checksums, name)) throw new Error("Checksum mismatch — refusing to run download");

  await Bun.write(bin, binary);
  await chmod(bin, 0o755);
  return bin;
}

async function ensureEnv(): Promise<void> {
  const env = Bun.file(join(DIR, ".env"));
  if (await env.exists()) return;
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
  await Bun.write(env, `APP_URL=http://localhost:${PORT}\nPORT=${PORT}\nENCRYPTION_KEY=${key}\nTRUST_PROXY=false\n`);
}

if (import.meta.main) {
  await mkdir(DIR, { recursive: true });
  const bin = await ensureBinary();
  await ensureEnv();
  console.log(`Pocket ID → http://localhost:${PORT}  (first run: open /setup to create the admin passkey)`);
  // Pocket ID reads .env from its working directory and keeps its SQLite DB under ./data.
  await $`${bin}`.cwd(DIR);
}
