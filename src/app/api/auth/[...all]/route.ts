import { observeRoute } from "@inkspect/core/lib/diagnostics/http";
import { getSelfHostedAuth as getAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { captureError } from "@inkspect/core/lib/diagnostics/server";

export const runtime = "nodejs";

async function originalHandler(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch (error) {
    captureError("auth.request", error);
    return Response.json({ code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

const handler = observeRoute(originalHandler);
export { handler as GET, handler as POST };
