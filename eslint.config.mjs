import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/components/dashboard-shell.tsx", "src/lib/organization-access.ts",
      "src/lib/dashboard-edition.ts", "src/components/dashboard-edition.tsx",
      "src/components/app-sidebar.tsx", "src/components/nav-user.tsx",
      "src/components/command-menu.tsx", "src/components/byok-settings.tsx",
      "src/lib/member-routes.ts", "src/lib/membership-service.ts", "src/self-hosted/**",
      "src/lib/auth-factory.ts", "src/components/members-panel.tsx", "src/components/invitation-accept.tsx",
      "src/lib/chat-ai.ts", "src/lib/chat-store.ts",
      "src/lib/review-routes.ts", "src/lib/review-lifecycle.ts", "src/lib/review-identity.ts",
      "src/components/review-workspace.tsx",
      "src/lib/session.ts", "src/lib/workspace-status.ts", "src/lib/github-routes.ts",
      "src/lib/byok/routes.ts", "src/lib/byok/service.ts",
      "src/components/usage/**", "src/lib/usage/**",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/cloud/**", "**/cloud/**", "@/lib/billing/**", "**/billing/**"], message: "Shared dashboard composition and workspace authorization must not import Cloud/payment implementations." },
      ] }],
    },
  },
  globalIgnores([".next/**", ".local/**", "next-env.d.ts"]),
]);
