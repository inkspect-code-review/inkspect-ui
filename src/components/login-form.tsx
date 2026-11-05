"use client";
import { defaultAuthLinks, type AuthLinks } from "./auth-page-shell";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@inkspect/core/lib/auth-client";
import { authErrorMessage } from "@inkspect/core/lib/auth-errors";
import { NotificationToast, type ToastMessage } from "./notification-toast";
import { ProviderIcon } from "./provider-icon";
import { loginProviders, linkConfirmationPath, linkSignInPath, type LoginProvider, type LinkSource } from "@inkspect/core/lib/login-providers";
import { useLoginCooldown } from "./use-login-cooldown";
import type { LoginMethod } from "@inkspect/core/lib/auth-cooldown";

export function LoginForm({ callbackError, linkingProvider, linkingFrom, returnTo = "/dashboard", links = defaultAuthLinks, enabledProviders }: { links?: AuthLinks; enabledProviders?: readonly LoginProvider[]; returnTo?: string; callbackError?: string; linkingProvider?: LoginProvider; linkingFrom?: LinkSource }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(callbackError ? { id: 0, tone: "error", message: authErrorMessage(callbackError) } : null);
  const toastId = useRef(0);
  const inFlight = useRef(false);
  const cooldown = useLoginCooldown();
  const callbackURL = linkingProvider ? linkConfirmationPath(linkingProvider, linkingFrom) : returnTo;
  const linkingName = loginProviders.find(({ id }) => id === linkingProvider)?.name;

  function showError(message: string) {
    setToast({ id: ++toastId.current, tone: "error", message });
  }

  function limit(method: LoginMethod, response: Response) {
    cooldown.start(method, response);
    showError(method === "email"
      ? "Too many email requests. Wait for the countdown before requesting another link."
      : "Too many sign-in attempts. Wait for the countdown before trying again.");
  }

  useEffect(() => {
    const restoreFromHistory = (event: PageTransitionEvent) => {
      if (event.persisted) {
        inFlight.current = false;
        setPending(null);
      }
    };
    window.addEventListener("pageshow", restoreFromHistory);
    return () => window.removeEventListener("pageshow", restoreFromHistory);
  }, []);

  async function signIn(provider: LoginProvider) {
    if (inFlight.current || cooldown.isBlocked("social")) return;
    inFlight.current = true;
    setPending(provider);
    setToast(null);
    let redirecting = false;
    try {
      const errorCallbackURL = linkingProvider ? linkSignInPath(linkingProvider, linkingFrom) : `/login?link=${provider}`;
      const result = await authClient.signIn.social({ provider, callbackURL, errorCallbackURL, fetchOptions: {
        onError: ({ response }) => { if (response.status === 429) limit("social", response); },
      } });
      if (result.error) { reportBrowserError("browser.login.form", result.error); if (result.error.status !== 429) showError(authErrorMessage(result.error.code, result.error.status)); }
      else if (result.data?.redirect && result.data.url) redirecting = true;
      else showError(authErrorMessage());
    } catch (diagnosticError) { reportBrowserError("browser.login.form", diagnosticError);
      showError("Couldn’t connect. Check your connection and try again.");
    } finally {
      // Keep the loading state until navigation; resetting here causes a flash.
      if (!redirecting) {
        inFlight.current = false;
        setPending(null);
      }
    }
  }

  async function signInWithPasskey() {
    if (inFlight.current) return;
    inFlight.current = true; setPending("passkey"); setToast(null);
    try {
      if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error("Passkeys require a supported browser and a secure connection.");
      const result = await authClient.signIn.passkey();
      if (result?.error) showError(result.error.message || "Couldn’t sign in with a passkey.");
      else if (result?.data) {
        const challenged = "twoFactorRedirect" in result.data && result.data.twoFactorRedirect;
        window.location.assign(challenged ? `/login/two-factor?next=${encodeURIComponent(callbackURL)}` : callbackURL);
        return;
      }
    } catch (error) { showError(error instanceof Error ? error.message : "Couldn’t sign in with a passkey."); }
    inFlight.current = false; setPending(null);
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || cooldown.isBlocked("email")) return;
    inFlight.current = true;
    setPending("email");
    setToast(null);
    try {
      const address = email.trim();
      const result = await authClient.signIn.magicLink({ email: address, callbackURL, newUserCallbackURL: callbackURL, errorCallbackURL: linkingProvider ? linkSignInPath(linkingProvider, linkingFrom) : "/login", fetchOptions: {
        onError: ({ response }) => { if (response.status === 429) limit("email", response); },
      } });
      if (result.error) { reportBrowserError("browser.login.form", result.error); if (result.error.status !== 429) showError(authErrorMessage(result.error.code, result.error.status)); }
      else { setSentTo(address); setToast({ id: ++toastId.current, tone: "success", message: `We sent a sign-in link to ${address}.` }); }
    } catch (diagnosticError) { reportBrowserError("browser.login.form", diagnosticError);
      showError("Couldn’t send the link. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  if (sentTo) return <div className="login-content">
    <div className="status-icon" aria-hidden="true">↗</div>
    <h1>Check your inbox.</h1>
    <p className="intro-copy">Open the sign-in link in your inbox to continue to Inkspect.</p>
    <NotificationToast toast={toast} />
    <p className="delivery-note">The link is valid for 10 minutes. If you don’t see it, check your spam folder.</p>
    <button className="button secondary" onClick={() => { setSentTo(""); setToast(null); }}>Back to sign in</button>
  </div>;

  return <div className="login-content">
    <h1>{linkingProvider ? "Confirm your account." : "Welcome to Inkspect."}</h1>
    <p className="intro-copy">{linkingProvider ? `Sign in with your existing method to connect ${linkingName}. Your workspace will stay with the same account.` : "Sign in or create your Inkspect account."}</p>
    <div className="provider-list" aria-label="Sign-in methods">
      {loginProviders.filter(({ id }) => id !== linkingProvider && (!enabledProviders || enabledProviders.includes(id))).map(({ id, name }) => <button key={id} className={`button ${id === "github" ? "primary" : "secondary"}`} disabled={!!pending || cooldown.seconds.social > 0} aria-busy={pending === id} aria-label={pending === id ? `Connecting to ${name}` : undefined} onClick={() => signIn(id)}>
        <span className="provider-icon-slot" aria-hidden="true">
          {pending === id ? <span className="spinner" /> : <ProviderIcon provider={id} />}
        </span>
        <span>{`Continue with ${name}`}{cooldown.seconds.social > 0 && ` (${cooldown.seconds.social}s)`}</span>
      </button>)}
      <button className="button secondary" disabled={!!pending} onClick={signInWithPasskey}>{pending === "passkey" ? "Waiting for passkey…" : "Continue with a passkey"}</button>
    </div>
    <div className="divider"><span>or use your email</span></div>
    <form onSubmit={sendLink} aria-busy={pending === "email"}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required value={email} disabled={!!pending} onChange={(event) => setEmail(event.target.value)} />
      <button className="button secondary email-submit" type="submit" disabled={!!pending || cooldown.seconds.email > 0}>{pending === "email" ? "Sending link…" : cooldown.seconds.email > 0 ? `Try again in ${cooldown.seconds.email} seconds` : "Send me a sign-in link"}</button>
    </form>
    <NotificationToast toast={toast} />
    {linkingProvider && <a className="back-link" href="/login">Cancel and return to sign in</a>}
    {links.terms && links.privacy && <p className="terms-copy">By continuing, you agree to the <a href={links.terms}>Terms</a> and <a href={links.privacy}>Privacy Policy</a>.</p>}
  </div>;
}
