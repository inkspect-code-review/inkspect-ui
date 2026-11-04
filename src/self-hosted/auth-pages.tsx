import { createAuthPages } from "../lib/auth-pages";
import { getSelfHostedAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { InvitationAccept } from "../components/invitation-accept";
import { socialProviders } from "@inkspect/core/lib/auth-config";
import { isLoginProvider } from "@inkspect/core/lib/login-providers";
export const { LoginPage, AccountLinkPage, TwoFactorPage, InvitePage, WelcomePage } = createAuthPages({
  getAuth: getSelfHostedAuth, Invitation: InvitationAccept,
  links: { home: "/", terms: process.env.INKSPECT_TERMS_URL, privacy: process.env.INKSPECT_PRIVACY_URL },
  enabledProviders: () => Object.keys(socialProviders() ?? {}).filter(isLoginProvider),
});
