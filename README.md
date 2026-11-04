# inkspect-ui

Shared dashboard components and a runnable self-hosted Next application.

## Local development

Requires Node >=22.13. Run `npm ci`, `npm run audit`, `npm test`, and `npm run build`.

This checkout installs independently: internal dependencies are versioned source packages in `vendor/`, with integrity recorded in `package-lock.json`. No sibling checkout, symlink, private registry login or original monorepo is needed. They are generated dependency artifacts; edit each dependency in its own repository and rebuild it with `npm run pack`. Never edit installed package copies.

Internal dependencies: `@inkspect/core`.

Copy `.env.example` to `.env.local`. The UI and matching API must use the same database, auth origin and secret. Set `INKSPECT_API_ORIGIN` before build to the API address; keep `NEXT_PUBLIC_API_ORIGIN` empty for same-origin proxying. Run `npm run dev` for local development or `npm run build && npm start` for production. Production auth requires HTTPS. Configure SMTP or OAuth for sign-in.

Use the main `inkspect` repository to assemble compatible self-hosted releases. Repository privacy and package publication are controlled separately; all new repositories currently remain private. No production deployment is performed by local build/test commands.

Licensing is pending owner approval. `LICENSE.proposed` is a draft; this snapshot is not yet a public open-source release.
