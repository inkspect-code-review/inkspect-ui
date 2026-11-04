"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";
import type { DashboardMember } from "@inkspect/core/lib/dashboard";
import type { Invitation } from "@inkspect/core/lib/membership-service";
import styles from "./members-panel.module.css";

export function MembersPanel({ organizationId, members, canManage }: { organizationId: string; members: DashboardMember[]; canManage: boolean }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(canManage);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const endpoint = `/api/members?${new URLSearchParams({ organizationId })}`;
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    void productFetch(endpoint, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not load invitations.");
      if (!controller.signal.aborted) setInvitations(value.invitations);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canManage, endpoint, revision]);
  async function act(body: object) {
    if (!canManage || pending.current) return;
    pending.current = true; setBusy(true); setError(""); setLink("");
    try {
      const response = await productFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not update invitations.");
      if (typeof value.url === "string") {
        const url = new URL(value.url);
        if (url.origin !== window.location.origin || url.pathname !== "/invite") throw new Error("Invalid invitation destination.");
        setLink(url.href); setEmail("");
      }
      setRevision(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update invitations."); }
    finally { pending.current = false; setBusy(false); }
  }
  function invite(event: FormEvent) { event.preventDefault(); void act({ action: "invite", email, role }); }
  return <div className={styles.panel} aria-busy={busy}>
    {error && <p role="alert">{error}</p>}
    <section><h2>Organization members</h2><div className={styles.scroll}><table><thead><tr><th>Member</th><th>Role</th></tr></thead><tbody>
      {members.map(member => <tr key={member.id}><td><strong>{member.name || member.email}</strong><span>{member.email}</span></td><td>{member.role}</td></tr>)}
    </tbody></table></div></section>
    {canManage && <section><h2>Invite a teammate</h2><p>Choose their workspace role and share an invitation link.</p>
      <form onSubmit={invite} className={styles.form}>
        <label>Email address<input type="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
        <label>Role<select value={role} disabled={busy} onChange={event => setRole(event.target.value)}><option value="member">Member</option><option value="admin">Admin</option></select></label>
        <button disabled={busy} type="submit">Create invitation</button>
      </form>
      {link && <label>Share this invitation link<input readOnly value={link} onFocus={event => event.target.select()} /><small>No email has been sent. The link expires in seven days.</small></label>}
      {loading ? <p role="status">Loading invitations…</p> : <div className={styles.scroll}><table><caption>Pending invitations</caption><thead><tr><th>Email</th><th>Role</th><th>Expires</th><th>Actions</th></tr></thead><tbody>
        {invitations.map(invitation => <tr key={invitation.id}><td>{invitation.email}</td><td>{invitation.role}</td><td>{new Date(invitation.expires_at).toLocaleDateString()}</td><td><button disabled={busy} onClick={() => setLink(`${window.location.origin}/invite?id=${invitation.id}`)}>Get link</button><button disabled={busy} onClick={() => void act({ action: "cancel", id: invitation.id })}>Cancel invitation</button></td></tr>)}
      </tbody></table>{!invitations.length && <p>No pending invitations.</p>}</div>}
    </section>}
  </div>;
}
