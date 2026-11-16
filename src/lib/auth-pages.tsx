import { LoginForm } from "../components/login-form";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AccountLinkForm } from "../components/account-link-form";
import { LINK_CONFIRMATION_MAX_AGE_MS } from "@inkspect/core/lib/account-linking";
import { TwoFactorForm } from "../components/two-factor-form";
import { AccountOnboardingForm } from "../components/account-onboarding-form";
import type { ComponentType } from "react";
import { AuthPageShell, defaultAuthLinks, type AuthLinks } from "../components/auth-page-shell";
import { accountEntryPath, requiresAccountOnboarding } from "@inkspect/core/lib/account-onboarding-config";
import { onboardingDestination, welcomePath } from "@inkspect/core/lib/account-onboarding";
import { isLoginProvider, lastLoginMethodCookie, parseLoginMethod, linkConfirmationPath, linkSignInPath, type LoginProvider } from "@inkspect/core/lib/login-providers";
import { isOpenSourceApplicationPath } from "@inkspect/core/lib/sign-in-destinations";
import { createSessionHelpers } from "@inkspect/core/lib/session";
import type { Auth } from "@inkspect/core/lib/github";

export function createAuthPages({ getAuth, Invitation, links = defaultAuthLinks, enabledProviders }: {
  getAuth: () => Auth; Invitation: ComponentType<{ id: string }>; links?: AuthLinks;
  enabledProviders?: () => readonly LoginProvider[];
}) {
  const { getSession } = createSessionHelpers(getAuth);
async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[]; link?: string | string[]; confirm?: string; from?: string; next?: string }>;
}) {
  const { error, link, confirm, from, next } = await searchParams;
  const returnTo = onboardingDestination(next);
  const linkingProvider = isLoginProvider(link) && (error === "account_not_linked" || confirm === "1") ? link : undefined;
  const linkingFrom = from === "settings" ? "settings" : undefined;
  const session = await getSession();
  if (session) redirect(linkingProvider ? linkConfirmationPath(linkingProvider, linkingFrom) : !requiresAccountOnboarding(session.user) ? returnTo : welcomePath(returnTo));
  const lastUsedMethod = parseLoginMethod((await cookies()).get(lastLoginMethodCookie)?.value);
  return <AuthPageShell links={links}><LoginForm lastUsedMethod={lastUsedMethod} links={links} enabledProviders={enabledProviders?.()} returnTo={accountEntryPath(returnTo)} callbackError={typeof error === "string" ? error : undefined} linkingProvider={linkingProvider} linkingFrom={linkingFrom} /></AuthPageShell>;
}

async function AccountLinkPage({ searchParams }: {
  searchParams: Promise<{ provider?: string; error?: string; from?: string }>;
}) {
  const { provider, error, from } = await searchParams;
  const source = from === "settings" ? "settings" : undefined;
  if (!isLoginProvider(provider)) redirect("/login");
  const session = await getSession();
  if (!session) redirect(linkSignInPath(provider, source));
  const accounts = await getAuth().api.listUserAccounts({ headers: await headers() });
  const connected = accounts.some((account) => account.providerId === provider);
  // This server page is rendered per request after reading the session headers.
  const age = Date.now() - new Date(session.session.createdAt).getTime();
  return <AuthPageShell links={links}><AccountLinkForm provider={provider} email={session.user.email}
    connected={connected && !error} needsReauth={age < 0 || age >= LINK_CONFIRMATION_MAX_AGE_MS}
    callbackError={error} from={source} /></AuthPageShell>;
}

async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Retain account-link confirmation and the explicitly allowed application path.
  const destination = next?.startsWith("/login/link?") || next === "/welcome" || next?.startsWith("/welcome?next=") || isOpenSourceApplicationPath(next) ? next : "/dashboard";
  return <AuthPageShell links={links}><TwoFactorForm next={destination} /></AuthPageShell>;
}

async function InvitePage({searchParams}:{searchParams:Promise<{id?:string}>}) {
  const {id}=await searchParams;
  if(!id||!/^[a-f0-9-]{36}$/.test(id))return <AuthPageShell links={links}><div className="login-content"><h1>Invalid invitation</h1><p className="intro-copy">Ask the workspace owner for a new invitation link.</p></div></AuthPageShell>;
  const session = await getSession();
  if(!session)redirect(`/login?next=${encodeURIComponent(`/invite?id=${id}`)}`);
  if (requiresAccountOnboarding(session.user)) redirect(welcomePath(`/invite?id=${id}`));
  return <AuthPageShell links={links}><Invitation id={id}/></AuthPageShell>;
}

async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = onboardingDestination((await searchParams).next);
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!requiresAccountOnboarding(session.user)) redirect(next);
  return <AuthPageShell links={links} label="Account setup"><AccountOnboardingForm links={links} name={session.user.name} next={next} /></AuthPageShell>;
}

return { LoginPage, AccountLinkPage, TwoFactorPage, InvitePage, WelcomePage };
}
