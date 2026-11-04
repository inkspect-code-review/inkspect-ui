import { getSelfHostedAuth as getAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { handleWorkspaceLogo } from "@inkspect/core/lib/workspace-logo-route";

export const runtime = "nodejs";
const handle = (request: Request) => handleWorkspaceLogo(request, getAuth());
export { handle as GET, handle as POST, handle as DELETE };
