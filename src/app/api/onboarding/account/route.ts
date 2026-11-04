import { getSelfHostedAuth as getAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { handleAccountOnboarding } from "@inkspect/core/lib/account-onboarding-route";
import { observeRoute } from "@inkspect/core/lib/diagnostics/http";

export const POST = observeRoute((request: Request) => handleAccountOnboarding(request, getAuth()));
