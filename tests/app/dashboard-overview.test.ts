import test from "node:test";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("dashboard renders its initial overview without replacing a loading layout", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const local = join(root, ".local");
  await mkdir(local, { recursive: true });
  const dir = await mkdtemp(join(local, "dashboard-overview-test-"));
  try {
    const out = join(dir, "render.cjs");
    await build({ absWorkingDir: root, entryPoints: ["tests/app/fixtures/dashboard-overview-render.tsx"], bundle: true, platform: "node", target: "node22", format: "cjs", external:["linkedom","@aws-sdk/client-s3","@aws-sdk/client-sesv2","@better-auth/core","@better-auth/passkey","@fontsource-variable/manrope","@pubb/sdk","@smithy/eventstream-codec","@smithy/util-utf8","better-auth","class-variance-authority","cmdk","cn","lucide-react","next","nodemailer","pg","radix-ui","react","react-dom","react-markdown","react-qr-code","remark-gfm","remark-parse","sharp","tw-animate-css","unified","@hono/node-server","hono"], jsx: "automatic", loader: { ".css": "empty" }, outfile: out, logLevel: "silent" });
    await promisify(execFile)(process.execPath, ["--test", out]).catch(error => { throw new Error(error.stdout || error.message, { cause: error }); });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
