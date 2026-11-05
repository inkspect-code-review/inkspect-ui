"use client";

import { Notification, useNotificationMessage } from "./notification-toast";
import { useRef, useState } from "react";
import { authClient } from "@inkspect/core/lib/auth-client";

export function TwoFactorForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError, errorNotificationKey] = useNotificationMessage("");
  const lock = useRef(false);
  return <div className="login-content">
    <h1>Verify your sign-in.</h1>
    <p className="intro-copy">{backup ? "Enter one of your saved recovery codes." : "Enter the six-digit code from your authenticator app."}</p>
    <form aria-busy={busy} onSubmit={async event => {
      event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError("");
      try {
        const result = backup ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() }) : await authClient.twoFactor.verifyTotp({ code: code.trim() });
        if (result.error) setError(result.error.message || "Couldn’t verify the code. Try again or restart sign-in.");
        else { window.location.assign(next); return; }
      } catch { setError("Couldn’t connect. Please try again."); }
      lock.current = false; setBusy(false);
    }}>
      <label htmlFor="verification-code">{backup ? "Recovery code" : "Authenticator code"}</label>
      <input id="verification-code" autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} pattern={backup ? undefined : "[0-9]{6}"} maxLength={backup ? 32 : 6} required value={code} disabled={busy} onChange={event => setCode(event.target.value)} />
      <button className="button primary email-submit" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}</button>
    </form>
    <Notification tone="error" message={error} notificationKey={errorNotificationKey} />
    <button className="button secondary email-submit" disabled={busy} onClick={() => { setBackup(!backup); setCode(""); setError(""); }}>{backup ? "Use authenticator app" : "Use a recovery code"}</button>
    <a className="back-link" href="/login">Restart sign-in</a>
  </div>;
}
