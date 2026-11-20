# inkspect-ui

Shared dashboard components and a runnable self-hosted Next application.

## Local development

Requires Node >=22.13. Run `npm ci`, `npm run audit`, `npm test`, and `npm run build`.

This checkout installs independently: internal dependencies are versioned source packages in `vendor/`, with integrity recorded in `package-lock.json`. No sibling checkout, symlink, private registry login or original monorepo is needed. They are generated dependency artifacts; edit each dependency in its own repository and rebuild it with `npm run pack`. Never edit installed package copies.

Internal dependencies: `@inkspect/core`.

Copy `.env.example` to `.env.local`. The UI and matching API must use the same database, auth origin and secret. Set `INKSPECT_API_ORIGIN` before build to the API address; keep `NEXT_PUBLIC_API_ORIGIN` empty for same-origin proxying. Run `npm run dev` for local development or `npm run build && npm start` for production. Production auth requires HTTPS. Configure SMTP or OAuth for sign-in.

Use the main `inkspect` repository to assemble compatible self-hosted releases. Repository privacy and package publication are controlled separately; all new repositories currently remain private. No production deployment is performed by local build/test commands.

Source code is licensed under [MIT](LICENSE). Third-party dependencies retain their own licenses.

## Download review findings

Open a completed review in **Dashboard → Reviews → Overview** and select **Download SARIF**.
The browser creates a SARIF 2.1.0 file for the recorded revision, including reviews
with zero findings. The file records incomplete coverage and excluded file counts.
Paths are relative to the repository root. Repeated findings are matched using the
path, normalized title and occurrence in source order. Renaming the file or rewording
the title can change the fingerprint. The download stays local to your browser.

## Ignored pull request authors

Use **Settings → Workspace → Automatic reviews → GitHub check failure threshold** to select the lowest severity that fails a new PR check. The default is P0 (critical).

Open **Settings → Workspace → Automatic reviews → Ignored PR authors** to skip
automation for selected GitHub accounts across the workspace. Owners and admins
can enter up to 100 usernames, one per line or separated by commas, and save the list.
Use **Add Dependabot** to insert `dependabot[bot]`; other bots also need their full
login, such as `renovate[bot]`. Usernames are case-insensitive. An empty list allows
all authors. Explicit dashboard reviews and fixes remain available.

## Contributing and community

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, commit notation and
opening a pull request. All changes need an entry in [CHANGELOG.md](CHANGELOG.md).
Follow our [Code of Conduct](CODE_OF_CONDUCT.md), use [SUPPORT.md](SUPPORT.md)
for help, and report vulnerabilities privately using [SECURITY.md](SECURITY.md).
