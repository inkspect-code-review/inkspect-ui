"use client";

import { defaultAuthLinks, type AuthLinks } from "./auth-page-shell";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ageConfirmationCopy } from "@inkspect/core/lib/account-onboarding";
import { authClient } from "@inkspect/core/lib/auth-client";
import styles from "./account-onboarding-form.module.css";

export function AccountOnboardingForm({ name: initialName, next, links = defaultAuthLinks }: { name: string; next: string; links?: AuthLinks }) {
  const router = useRouter();
  const [name, setName] = useState(initialName.slice(0, 100));
  const [referralSource, setReferralSource] = useState("");
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    try {
      const response = await fetch("/api/onboarding/account", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, referralSource, confirmAdult, next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t save your details. Try again.");
      router.replace(result.next);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t connect. Check your connection and try again.");
      inFlight.current = false; setPending(false);
    }
  }

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Couldn’t sign out. Try again.");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Couldn’t sign out. Check your connection and try again.");
      inFlight.current = false; setPending(false);
    }
  }

  return <div className="login-content">
    <h1>A little about you.</h1>
    <p className="intro-copy">Before you get started, confirm you’re an adult. The other details are optional.</p>
    <form onSubmit={submit} className={styles.form} aria-busy={pending}>
      <div><label htmlFor="onboarding-name">Your name <span className={styles.optional}>(optional)</span></label>
        <input id="onboarding-name" name="name" autoComplete="name" maxLength={100} value={name} disabled={pending} onChange={event => setName(event.target.value)} /></div>
      <div><label htmlFor="referral-source">How did you hear about us? <span className={styles.optional}>(optional)</span></label>
        <input id="referral-source" name="referralSource" maxLength={300} placeholder="A friend, GitHub, a podcast…" value={referralSource} disabled={pending} onChange={event => setReferralSource(event.target.value)} /></div>
      <div className={styles.confirmation}>
        <label className={styles.checkboxLabel} htmlFor="confirm-adult">
          <input data-slot="age-confirmation" id="confirm-adult" name="confirmAdult" type="checkbox" required checked={confirmAdult} disabled={pending} aria-describedby="adult-requirement" onChange={event => setConfirmAdult(event.target.checked)} />
          <span>{ageConfirmationCopy}</span>
        </label>
        <p id="adult-requirement" className={styles.requirement}>You must be an adult to use Inkspect.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={pending || !confirmAdult}>{pending ? "Please wait…" : "Continue to Inkspect"}</button>
    </form>
    {links.terms && links.privacy && <p className="terms-copy">By continuing, you agree to the <a href={links.terms}>Terms</a> and acknowledge the <a href={links.privacy}>Privacy Policy</a>.</p>}
    <button type="button" className={styles.signOut} disabled={pending} onClick={signOut}>Sign out</button>
  </div>;
}
