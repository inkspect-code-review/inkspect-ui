# Inkspect UI

`@inkspect/ui` contains the self-hosted Next.js dashboard and its shared React components. The dashboard runs alongside the Inkspect API. To install both services and the review workers together, use the [Docker Compose guide](https://github.com/inkspect-code-review/inkspect#install).

## How a review reaches the screen

Follow a request to `/dashboard?view=reviews` through three parts of the application.

| Layer | Responsibility |
| --- | --- |
| [Workspace pages](src/lib/workspace-pages.tsx) | On the server, validate the session, resolve the active workspace from the user’s memberships and select the requested dashboard section. |
| [Self-hosted dashboard](src/self-hosted/dashboard.tsx) | Supply the edition’s navigation and panels to the shared [dashboard shell](src/components/dashboard-shell.tsx). The shell renders `ReviewWorkspace` for the Reviews section. |
| [Review workspace](src/components/review-workspace.tsx) | Load reviews from `/api/reviews` and track the selected run. When its report is ready, pass it to [ReviewReportView](src/components/review-report.tsx) to render findings, scores and evidence. |

Next.js handles sign-in in this app. Review requests go through a same-origin rewrite to the API. If you change where those requests go, edit [next.config.ts](next.config.ts). If you change how a finding looks, start in `ReviewReportView` and run its rendering test:

```sh
node --import tsx --test tests/app/review-report.test.ts
```

## Run locally

Use Node.js 22.13 or newer and a running [Inkspect API](https://github.com/inkspect-code-review/inkspect-api) with its PostgreSQL migrations applied. From this checkout:

```sh
npm ci
cp .env.example .env.local
```

In `.env.local`, use the API’s `DATABASE_URL` and `BETTER_AUTH_SECRET`. Set the same `BETTER_AUTH_URL` in both services and configure GitHub OAuth or SMTP for sign-in. For the default local ports, use:

```dotenv
BETTER_AUTH_URL=http://127.0.0.1:3002
INKSPECT_API_ORIGIN=http://127.0.0.1:3003
```

Run `npm run dev` and open `http://127.0.0.1:3002`.

[Contributing and checks](CONTRIBUTING.md) · [MIT license](LICENSE)
