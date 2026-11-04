import { captureError } from "@inkspect/core/lib/diagnostics/server";
import { observeRoute } from "@inkspect/core/lib/diagnostics/http";
import { NextRequest, NextResponse } from "next/server";
import { getSelfHostedAuth as getAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { readAuthEnvironment } from "@inkspect/core/lib/auth-config";
import { workspaceAdmin } from "@inkspect/core/lib/github";
async function handlePOST(request: NextRequest) {
  const { baseURL } = readAuthEnvironment();
  if (request.headers.get("origin") !== baseURL) return new Response(null, { status: 403 });
  const auth = getAuth();
  let organizationId: string;
  try { ({ organizationId } = await workspaceAdmin(auth, request.headers)); }
  catch (error) { captureError("onboarding.skip", error); return new Response(null, { status: 403 }); }
  const { adapter } = await auth.$context;
  await adapter.transaction(async (tx) => {
    await tx.update({ model: "organization", where: [{ field: "id", value: organizationId }], update: { id: organizationId } });
    const existing = await tx.findOne({ model: "workspaceSetup", where: [{ field: "organizationId", value: organizationId }] });
    if (!existing) await tx.create({ model: "workspaceSetup", data: { organizationId, dismissedAt: new Date() } });
  });
  return NextResponse.redirect(`${baseURL}/dashboard`, 303);
}

export const POST = observeRoute(handlePOST);
