import assert from "node:assert/strict";
import type { Auth } from "@inkspect/core/lib/github";
import { handleAccountOnboarding } from "@inkspect/core/lib/account-onboarding-route";
import { accountOnboardingEnabled } from "@inkspect/core/lib/account-onboarding-config";

export async function confirmAdultAccount(auth: Auth, cookie: string) {
  if (!accountOnboardingEnabled()) return;
  const origin = new URL(auth.options.baseURL!).origin;
  const response = await handleAccountOnboarding(new Request(`${origin}/api/onboarding/account`, {
    method: "POST", headers: { origin, cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ confirmAdult: true, name: "", referralSource: "" }),
  }), auth);
  assert.equal(response.status, 200, await response.text());
}
