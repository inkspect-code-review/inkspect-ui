"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthCancellation } from "./auth-cancellation-toast";
import { useNotifications } from "./notification-toast";
import { ConfirmationDialog } from "./confirmation-dialog";
import { Check, Copy } from "lucide-react";
import QRCode from "react-qr-code";
import { authClient } from "@inkspect/core/lib/auth-client";
import styles from "./settings.module.css";
import shared from "./dashboard.module.css";

export function AccountSecurity() {
  const router = useRouter();
  const { notify, clearToast } = useNotifications();
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
  const lock = useRef(false);
  const manualKey = setup ? new URL(setup.totpURI).searchParams.get("secret") || "" : "";
  const enabled = session.data?.user.twoFactorEnabled === true;

  useEffect(() => {
    if (session.error) notify("error", "Couldn’t load your account security status. Refresh the page to try again.");
  }, [session.error, notify]);
  useEffect(() => {
    if (passkeys.error) notify("error", "Couldn’t load passkeys. Use Retry to load them again.");
  }, [passkeys.error, notify]);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); clearToast();
    try { await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Couldn’t complete the request. Please try again.";
      notify(isAuthCancellation(message) ? "info" : "error", message, message.includes("Sign in again") ? {
        label: "Sign in again", onClick: () => void run(async () => {
          const result = await authClient.signOut(); check(result.error); router.push("/login"); router.refresh();
        }),
      } : undefined);
    }
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
          <ConfirmationDialog open={confirmDisable} onOpenChange={setConfirmDisable} title="Disable two-factor authentication?"
            description="Your account will no longer require an authenticator code." confirmLabel="Disable 2FA" busy={busy}
            trigger={<button type="button" className={shared.secondaryButton} disabled={busy}>Disable 2FA</button>} onConfirm={() => void run(async () => {
            const result = await authClient.twoFactor.disable({}); check(result.error); setCodes([]); setConfirmDisable(false); await session.refetch(); notify("success", "Two-factor authentication disabled.");
          })} />
          <button className={shared.secondaryButton} disabled={busy} onClick={() => run(async () => {
            const result = await authClient.twoFactor.generateBackupCodes({}); check(result.error); if (result.data) { setCodes(result.data.backupCodes); notify("success", "Recovery codes replaced. Save the new codes before leaving this page."); }
          })}>Replace recovery codes</button><p className={styles.hint}>Replacing codes immediately invalidates all previous recovery codes.</p>
        </>}

      </div>
      {(setup || codes.length > 0) && <div className={`${styles.field} ${styles.securityStack} ${styles.securityExpanded}`}>
        {codes.length > 0 && <div className={styles.recoveryPanel}>
          <div className={styles.recoveryHeader}><div><h4>Save your recovery codes</h4><p className={styles.hint}>Each code works once if you lose access to your authenticator.</p></div><button type="button" className={shared.secondaryButton} onClick={downloadCodes}>Download codes</button></div>
          <div className={styles.recoveryBox}><ul className={styles.recoveryGrid} aria-label="Recovery codes">{codes.map(recoveryCode => <li key={recoveryCode}><code>{recoveryCode}</code></li>)}</ul><button type="button" className={styles.copyCodes} aria-label={copiedCodes === codes.join("\n") ? "Recovery codes copied" : "Copy recovery codes"} title={copiedCodes === codes.join("\n") ? "Copied" : "Copy recovery codes"} onClick={async () => {
            try { await navigator.clipboard.writeText(codes.join("\n")); setCopiedCodes(codes.join("\n")); notify("success", "Recovery codes copied to clipboard."); }
            catch { notify("error", "Couldn’t copy recovery codes. Try downloading them instead."); }
          }}>{copiedCodes === codes.join("\n") ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button></div>
          {!setup && <button type="button" className={shared.secondaryButton} onClick={() => setCodes([])}>Done — hide codes</button>}
        </div>}
        {setup && <div className={styles.setupPanel}>
          <div className={styles.setupAuthenticator}>
            <div className={styles.securityQr}><QRCode value={setup.totpURI} size={136} /></div>
            <div className={styles.setupInstructions}><h4>Connect your authenticator</h4><p className={styles.hint}>Scan the QR code, then enter the six-digit code from your app.</p><details><summary>Enter a setup key manually</summary><div className={styles.manualKeyBox}><code className={styles.securitySecret}>{manualKey}</code><button type="button" className={styles.copyCodes} aria-label={copiedKey === manualKey ? "Setup key copied" : "Copy setup key"} title={copiedKey === manualKey ? "Copied" : "Copy setup key"} onClick={async () => {
              try { await navigator.clipboard.writeText(manualKey); setCopiedKey(manualKey); notify("success", "Setup key copied to clipboard."); }
              catch { notify("error", "Couldn’t copy the setup key. Select and copy it manually."); }
            }}>{copiedKey === manualKey ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button></div></details></div>
          </div>
          <form className={styles.setupVerification} onSubmit={event => { event.preventDefault(); void run(async () => {
            const result = await authClient.twoFactor.verifyTotp({ code }); check(result.error);
            setSetup(null); setCode(""); notify("success", "Two-factor authentication is enabled."); await session.refetch();
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
        {passkeys.isPending ? <p className={styles.hint}>Loading passkeys…</p> : passkeys.error ? <button className={shared.secondaryButton} onClick={() => { clearToast(); void passkeys.refetch(); }}>Retry loading passkeys</button> : !passkeys.data?.length ? <p className={styles.hint}>No passkeys added yet.</p> : passkeys.data.map(key => <div key={key.id} className={styles.securityKey}><span>{key.name || "Passkey"}</span>
          <ConfirmationDialog open={removeId === key.id} onOpenChange={open => setRemoveId(open ? key.id : null)} title={`Remove “${key.name || "Passkey"}”?`}
            description="You can still use your other sign-in methods." confirmLabel="Remove passkey" busy={busy}
            trigger={<button type="button" className={shared.secondaryButton} disabled={busy}>Remove</button>}
            onConfirm={() => void run(async () => { const result = await authClient.passkey.deletePasskey({ id: key.id }); check(result.error); setRemoveId(null); await passkeys.refetch(); notify("success", "Passkey removed."); })} />
        </div>)}
        <form className={styles.securityStack} onSubmit={event => { event.preventDefault(); void run(async () => {
          if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error("Passkeys require a supported browser and a secure connection.");
          const result = await authClient.passkey.addPasskey({ name: name.trim() || "My passkey" }); check(result?.error ?? null);
          if (result?.data) { setName(""); await passkeys.refetch(); notify("success", "Passkey added."); }
        }); }}>
          <label htmlFor="passkey-name">Passkey name</label><input className={styles.input} id="passkey-name" maxLength={80} placeholder="e.g. MacBook" value={name} onChange={event => setName(event.target.value)} />
          <button className={shared.primaryButton} disabled={busy || !session.data}>Add passkey</button>
        </form>
      </div>
    </div>
  </div>;
}
