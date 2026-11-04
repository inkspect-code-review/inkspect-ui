import type { NextRequest } from "next/server";
import { observeRoute } from "@inkspect/core/lib/diagnostics/http";
import { getSelfHostedAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { startGitHub } from "@inkspect/core/lib/github-routes";
export const POST = observeRoute((request: NextRequest) => startGitHub(request, getSelfHostedAuth));
