"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCancellationToast, isAuthCancellation } from "./auth-cancellation-toast";
import { Check, Copy } from "lucide-react";
import QRCode from "react-qr-code";
import { authClient } from "@inkspect/core/lib/auth-client";
import styles from "./settings.module.css";
import shared from "./dashboard.module.css";

export function AccountSecurity() {
  const router = useRouter();
  const session = authClient.useSession();
  const passkeys = authClient.useListPasskeys();
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState("");
  const [copiedCodes, setCopiedCodes] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const manualKey = setup ? new URL(setup.totpURI).searchParams.get("secret") || "" : "";
  const enabled = session.data?.user.twoFactorEnabled === true;

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn’t complete the request. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  function check(error: { message?: string } | null) {
    if (error) throw new Error(error.message || "Couldn’t complete the request. Sign in again and retry.");
  }
  function downloadCodes() {
    const blob = new Blob([`Inkspect recovery codes\nKeep these private. Each code can be used once.\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "inkspect-recovery-codes.txt"; link.click(); URL.revokeObjectURL(url);
  }

  return <div aria-busy={busy}>
    <div className={styles.row}>
      <div className={styles.fieldDescription}><h3>Two-factor authentication</h3><p>Require an authenticator code after signing in, including with social accounts and passkeys.</p></div>
      <div className={`${styles.field} ${styles.securityStack} `}>
        <p className={styles.value}>{session.isPending ? "Loading…" : session.error ? "Status unavailable" : enabled ? "Enabled" : "Not enabled"}</p>
        {!setup && !enabled && <button className={shared.primaryButton} disabled={busy || !session.data} onClick={() => run(async () => {
          const result = await authClient.twoFactor.enable({}); check(result.error);
          if (result.data?.method === "totp") { setSetup({ totpURI: result.data.totpURI, backupCodes: result.data.backupCodes }); setCodes(result.data.backupCodes); setSaved(false); }
        })}>Set up authenticator</button>}
        {enabled && <>
          <button className={shared.secondaryButton} disabled={busy} onClick={() => setConfirmDisable(!confirmDisable)}>Disable 2FA</button>
          {confirmDisable && <><p className={styles.hint}>Your account will no longer require an authenticator code.</p><button className={shared.secondaryButton} disabled={busy} onClick={() => run(async () => {
            const result = await authClient.twoFactor.disable({}); check(result.error); setCodes([]); setConfirmDisable(false); await session.refetch(); setMessage("Two-factor authentication disabled.");
          })}>Confirm disable</button></>}
          <button className={shared.secondaryButton} disabled={busy} onClick={() => run(async () => {
            const result = await authClient.twoFactor.generateBackupCodes({}); check(result.error); if (result.data) setCodes(result.data.backupCodes);
          })}>Replace recovery codes</button><p className={styles.hint}>Replacing codes immediately invalidates all previous recovery codes.</p>
        </>}

      </div>
      {(setup || codes.length > 0) && <div className={`${styles.field} ${styles.securityStack} ${styles.securityExpanded}`}>
        {codes.length > 0 && <div className={styles.recoveryPanel}>
          <div className={styles.recoveryHeader}><div><h4>Save your recovery codes</h4><p className={styles.hint}>Each code works once if you lose access to your authenticator.</p></div><button type="button" className={shared.secondaryButton} onClick={downloadCodes}>Download codes</button></div>
          <div className={styles.recoveryBox}><ul className={styles.recoveryGrid} aria-label="Recovery codes">{codes.map(recoveryCode => <li key={recoveryCode}><code>{recoveryCode}</code></li>)}</ul><button type="button" className={styles.copyCodes} aria-label={copiedCodes === codes.join("\n") ? "Recovery codes copied" : "Copy recovery codes"} title={copiedCodes === codes.join("\n") ? "Copied" : "Copy recovery codes"} onClick={async () => {
            try { await navigator.clipboard.writeText(codes.join("\n")); setCopiedCodes(codes.join("\n")); }
            catch { setError("Couldn’t copy recovery codes. Try downloading them instead."); }
          }}>{copiedCodes === codes.join("\n") ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button><span className="sr-only" role="status">{copiedCodes === codes.join("\n") ? "Recovery codes copied to clipboard." : ""}</span></div>
          {!setup && <button type="button" className={shared.secondaryButton} onClick={() => setCodes([])}>Done — hide codes</button>}
        </div>}
        {setup && <div className={styles.setupPanel}>
          <div className={styles.setupAuthenticator}>
            <div className={styles.securityQr}><QRCode value={setup.totpURI} size={136} /></div>
            <div className={styles.setupInstructions}><h4>Connect your authenticator</h4><p className={styles.hint}>Scan the QR code, then enter the six-digit code from your app.</p><details><summary>Enter a setup key manually</summary><div className={styles.manualKeyBox}><code className={styles.securitySecret}>{manualKey}</code><button type="button" className={styles.copyCodes} aria-label={copiedKey === manualKey ? "Setup key copied" : "Copy setup key"} title={copiedKey === manualKey ? "Copied" : "Copy setup key"} onClick={async () => {
              try { await navigator.clipboard.writeText(manualKey); setCopiedKey(manualKey); }
              catch { setError("Couldn’t copy the setup key. Select and copy it manually."); }
            }}>{copiedKey === manualKey ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button><span className="sr-only" role="status">{copiedKey === manualKey ? "Setup key copied to clipboard." : ""}</span></div></details></div>
          </div>
          <form className={styles.setupVerification} onSubmit={event => { event.preventDefault(); void run(async () => {
            const result = await authClient.twoFactor.verifyTotp({ code }); check(result.error);
            setSetup(null); setCode(""); setMessage("Two-factor authentication is enabled."); await session.refetch();
          }); }}>
            <div><label htmlFor="setup-code">Authenticator code</label><input className={styles.input} id="setup-code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={event => setCode(event.target.value)} /></div>
            <label className={styles.securityConfirmation}><input type="checkbox" checked={saved} disabled={busy} onChange={event => setSaved(event.target.checked)} /><span>I have saved my recovery codes.</span></label>
            <div className={styles.setupActions}><button type="button" className={shared.secondaryButton} disabled={busy} onClick={() => { setSetup(null); setCodes([]); setCode(""); }}>Cancel setup</button><button type="submit" className={shared.primaryButton} disabled={busy || !saved}>Verify and enable</button></div>
          </form>
        </div>}

      </div>}
    </div>
    <div className={styles.row}>
      <div className={styles.fieldDescription}><h3>Passkeys</h3><p>Use your fingerprint, face, device PIN or security key to sign in.</p></div>
      <div className={`${styles.field} ${styles.securityStack}`}>
        {passkeys.isPending ? <p className={styles.hint}>Loading passkeys…</p> : passkeys.error ? <p role="alert">Couldn’t load passkeys. <button onClick={() => passkeys.refetch()}>Retry</button></p> : !passkeys.data?.length ? <p className={styles.hint}>No passkeys added yet.</p> : passkeys.data.map(key => <div key={key.id} className={styles.securityKey}><span>{key.name || "Passkey"}</span><button className={shared.secondaryButton} disabled={busy} onClick={() => setRemoveId(key.id)}>Remove</button>{removeId === key.id && <><p className={styles.hint}>Remove this passkey? You can still use your other sign-in methods.</p><button className={shared.secondaryButton} disabled={busy} onClick={() => run(async () => { const result = await authClient.passkey.deletePasskey({ id: key.id }); check(result.error); setRemoveId(null); await passkeys.refetch(); })}>Confirm removal</button><button className={shared.secondaryButton} onClick={() => setRemoveId(null)}>Cancel</button></>}</div>)}
        <form className={styles.securityStack} onSubmit={event => { event.preventDefault(); void run(async () => {
          if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error("Passkeys require a supported browser and a secure connection.");
          const result = await authClient.passkey.addPasskey({ name: name.trim() || "My passkey" }); check(result?.error ?? null);
          if (result?.data) { setName(""); await passkeys.refetch(); setMessage("Passkey added."); }
        }); }}>
          <label htmlFor="passkey-name">Passkey name</label><input className={styles.input} id="passkey-name" maxLength={80} placeholder="e.g. MacBook" value={name} onChange={event => setName(event.target.value)} />
          <button className={shared.primaryButton} disabled={busy || !session.data}>Add passkey</button>
        </form>
      </div>
    </div>
    {error && isAuthCancellation(error) && <AuthCancellationToast message={error} onDismiss={() => setError("")} />}
    {error && !isAuthCancellation(error) && <div><p className={shared.error} role="alert">{error}</p>{error.includes("Sign in again") && <button className={shared.secondaryButton} disabled={busy} onClick={() => run(async () => { const result = await authClient.signOut(); check(result.error); router.push("/login"); router.refresh(); })}>Sign in again</button>}</div>}
    {message && <p className={styles.saved} role="status">{message}</p>}
  </div>;
}
