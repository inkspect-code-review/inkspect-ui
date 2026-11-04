import type { ReactNode } from "react";
import { AnimatedEye } from "./animated-eye";

export type AuthLinks = { home: string; terms?: string; privacy?: string };
export const defaultAuthLinks: AuthLinks = { home: "https://inkspect.si", terms: "https://inkspect.si/terms", privacy: "https://inkspect.si/privacy" };
export function AuthPageShell({ children, label = "Sign in", links = defaultAuthLinks }: { children: ReactNode; label?: string; links?: AuthLinks }) {
  return <main className="login-shell" id="main">
    <aside className="brand-panel" aria-label="About Inkspect">
      <a className="brand" href={links.home} aria-label="Inkspect home">
        <span>Inkspect</span>
      </a>
      <div className="brand-visual">
        <AnimatedEye />
      </div>
      <div className="brand-story">
        <h2>Read between the lines.</h2>
      </div>
      <p className="brand-caption">Code review for the age of AI agents.</p>
    </aside>
    <section className="login-panel" aria-label={label}>
      <header className="login-header">
        <a className="brand mobile-brand" href={links.home} aria-label="Inkspect home">
          <span>Inkspect</span>
        </a>
        <a className="back-link" href={links.home}>Back to website <span aria-hidden="true">↗</span></a>
      </header>
      <div className="form-container">{children}</div>
      <footer className="login-footer">
        <span>Inkspect</span>
        <nav aria-label="Legal">{links.terms && <a href={links.terms}>Terms</a>}{links.privacy && <a href={links.privacy}>Privacy</a>}</nav>
      </footer>
    </section>
  </main>;
}
