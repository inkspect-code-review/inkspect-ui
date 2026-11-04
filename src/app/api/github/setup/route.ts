import type { NextRequest } from "next/server";
import { observeRoute } from "@inkspect/core/lib/diagnostics/http";
import { getSelfHostedAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { finishGitHub } from "@inkspect/core/lib/github-routes";
export const GET = observeRoute((request: NextRequest) => finishGitHub(request, "setup", getSelfHostedAuth));
