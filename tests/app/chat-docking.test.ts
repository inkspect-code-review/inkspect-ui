import test from "node:test";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("Ask AI preserves its conversation across right panel and floating window layouts", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const local = join(root, ".local");
  await mkdir(local, { recursive: true });
  const dir = await mkdtemp(join(local, "chat-docking-test-"));
  try {
    const out = join(dir, "render.cjs");
    await build({
      absWorkingDir: root, entryPoints: ["tests/app/fixtures/chat-docking-render.tsx"], outfile: out,
      bundle: true, platform: "node", target: "node22", format: "cjs", external: ["react", "react-dom", "next", "lucide-react", "radix-ui", "linkedom", "react-markdown", "remark-gfm", "cn", "class-variance-authority"],
      jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
      plugins: [{ name: "next-image", setup(builder) {
        builder.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "test" }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: 'export default "img"' }));
      } }],
    });
    // A nested Node test runner skips discovery when it inherits the parent test context.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    await promisify(execFile)(process.execPath, ["--test", out], { env }).catch(error => { throw new Error(error.stdout || error.message, { cause: error }); });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
