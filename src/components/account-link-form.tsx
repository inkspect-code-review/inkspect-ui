"use client";

import { Notification, useNotificationMessage } from "./notification-toast";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@inkspect/core/lib/auth-client";
import { authErrorMessage } from "@inkspect/core/lib/auth-errors";
import { linkConfirmationPath, linkSignInPath, loginProviders, type LoginProvider, type LinkSource } from "@inkspect/core/lib/login-providers";
import { isAuthCancellation } from "./auth-cancellation-toast";
import { ProviderIcon } from "./provider-icon";

export function AccountLinkForm({ provider, email, connected, needsReauth, callbackError, from }: {
  provider: LoginProvider; email: string; connected: boolean; needsReauth: boolean; callbackError?: string; from?: LinkSource;
}) {
  const router = useRouter();
  const name = loginProviders.find(({ id }) => id === provider)!.name;
  const returnHref = from === "settings" ? "/dashboard?view=settings" : "/dashboard";
  const [pending, setPending] = useState(false);
  const [reauth, setReauth] = useState(needsReauth || callbackError === "link_reauth_required");
  const [error, setError, errorNotificationKey] = useNotificationMessage(callbackError ? authErrorMessage(callbackError) : "");

  async function signInAgain() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      router.replace(linkSignInPath(provider, from));
      router.refresh();
    } catch {
      setError("Couldn’t start confirmation. Please try again.");
      setPending(false);
    }
  }

  async function connect() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.linkSocial({ provider,
        callbackURL: linkConfirmationPath(provider, from), errorCallbackURL: linkConfirmationPath(provider, from),
      });
      if (result.error) {
        if (result.error.code?.toLowerCase() === "link_reauth_required") setReauth(true);
        setError(authErrorMessage(result.error.code, result.error.status));
        setPending(false);
      } else if (!result.data?.url) {
        router.refresh();
        setPending(false);
      }
    } catch {
      setError("Couldn’t connect. Please try again.");
      setPending(false);
    }
  }

  if (connected) return <div className="login-content">
    <h1>{name} is connected.</h1>
    <p className="intro-copy">You can now use {name} or your existing sign-in method to access <strong>{email}</strong>.</p>
    <a className="button primary" href={returnHref}>{from === "settings" ? "Back to account settings" : "Continue to your workspace"}</a>
  </div>;

  return <div className="login-content">
    <h1>{reauth ? `Before you connect ${name}.` : `Connect ${name}?`}</h1>
    <p className="intro-copy">{reauth ? <>First, confirm it’s you by signing in to <strong>{email}</strong> with a method already connected to your Inkspect account. Then you’ll connect your {name} account.</> : <>You’re signed in as <strong>{email}</strong>. Continue to {name} and choose the account with this same email address.</>}</p>
    {!reauth && <p className="delivery-note">This adds another way to sign in. Your workspace stays with this account.</p>}
    <button className="button primary" disabled={pending} aria-busy={pending} onClick={reauth ? signInAgain : connect}>
      {pending ? <span className="spinner" /> : !reauth && <ProviderIcon provider={provider} />}
      {reauth ? "Continue to sign in" : `Confirm and connect ${name}`}
    </button>
    <Notification tone={isAuthCancellation(error) ? "info" : "error"} message={error} notificationKey={errorNotificationKey} />
    {!reauth && <button className="button secondary email-submit" disabled={pending} onClick={signInAgain}>Use a different Inkspect account</button>}
    <a className="back-link" href={returnHref}>Cancel</a>
  </div>;
}
