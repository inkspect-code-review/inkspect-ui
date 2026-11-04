import { diagnosticsEnabled, writeDiagnostic } from "@inkspect/core/lib/diagnostics/server";
import { safePath } from "@inkspect/core/lib/diagnostics/sanitize";
export const runtime = "nodejs";
const state = globalThis as typeof globalThis & { inkspectClientLogRate?: { start: number; count: number } };
export async function POST(request: Request) {
  if (!diagnosticsEnabled()) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  // A development-only, write-only endpoint. No log-reading HTTP API, no CORS.
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || origin !== url.origin || !request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 403 });
  if (!state.inkspectClientLogRate || Date.now() - state.inkspectClientLogRate.start > 60_000) state.inkspectClientLogRate = { start: Date.now(), count: 0 };
  if (++state.inkspectClientLogRate.count > 120) return new Response(null, { status: 429 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 32_000) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body.event !== "string" || !/^browser\.[a-z.]{1,50}$/.test(body.event)) return new Response(null, { status: 400 });
    const input = body.context || {};
    const context = Object.fromEntries(["page", "path", "file"].filter((key) => typeof input[key] === "string").map((key) => [key, safePath(input[key])]));
    for (const key of ["status", "line", "column"]) if (Number.isSafeInteger(input[key])) context[key] = input[key];
    if (typeof input.requestId === "string" && /^[0-9a-f-]{36}$/.test(input.requestId)) context.requestId = input.requestId;
    writeDiagnostic(body.event, body.error, context, "browser", body.event.endsWith("warn") ? "warn" : "error");
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 400 }); }
}
