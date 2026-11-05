import test from "node:test";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("sidebar renders application icons and preserves default navigation", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const local = join(root, ".local");
  await mkdir(local, { recursive: true });
  const dir = await mkdtemp(join(local, "sidebar-icons-test-"));
  try {
    const out = join(dir, "render.cjs");
    await build({
      absWorkingDir: root, entryPoints: ["tests/app/fixtures/sidebar-icons-render.tsx"],
      bundle: true, platform: "node", target: "node22", format: "cjs", packages: "external",
      jsx: "automatic", loader: { ".css": "empty" }, outfile: out, logLevel: "silent",
    });
    await promisify(execFile)(process.execPath, ["--test", out]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
