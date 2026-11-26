# Inkspect UI

The self-hosted Next.js dashboard and shared Inkspect UI components.

## Local development

1. Use Node.js 22.13 or newer. Run `npm ci` and copy `.env.example` to `.env.local`.
2. Match the API’s database, auth origin and secret. Set `INKSPECT_API_ORIGIN`
   before building and leave `NEXT_PUBLIC_API_ORIGIN` empty for same-origin requests.
3. Configure SMTP or OAuth for sign-in, then run `npm run dev`. Production sign-in requires HTTPS.

Run `npm run audit`, `npm test` and `npm run build` to check the dashboard.
Use `npm start` to serve the production build.

## Review settings and exports

- **Settings → Workspace → Automatic reviews** lets owners and admins choose the
  lowest severity that fails a new check (default P0) and ignore up to 100 GitHub
  logins. Include the full login for bots, such as `dependabot[bot]`. Ignored
  authors remain eligible for manually requested reviews and fixes.
- **Dashboard → Reviews → Overview → Download SARIF** exports a completed review as
  SARIF 2.1.0, including zero-finding reports. The local download records the
  revision, repository-relative paths, incomplete coverage and excluded file counts.
  Finding fingerprints use the path, normalized title and occurrence in source order.

[MIT license](LICENSE) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Support](SUPPORT.md) · [Security](SECURITY.md)
