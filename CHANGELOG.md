# Changelog

Record every code, fix, documentation, configuration, test and maintenance change
under `Unreleased` with its actual date. Use Added/Changed/Fixed/Removed sections
as appropriate. The package's `0.1.0` version is not a claim of a tagged release.

## Unreleased

### 2026-11-05

#### Added

- Let workspace owners and admins select which finding severities fail the GitHub review check.

- Manage ignored PR authors in workspace settings, including a shortcut to add Dependabot.

- Allow applications to supply sidebar section icons through dashboard widgets, retaining the default icons when no override is provided.

#### Fixed

- Use modal alert dialogs for destructive confirmations without expanding page content, including document/chat deletion and account-security changes.
- Use one application-wide toast outlet for authentication, reviews, repositories, chat, knowledge, members and other action results, preserving retry actions and quiet polling failures.
- Identify the active review provider and prevent saving an unchanged provider selection.
- Show workspace, logo, automatic review, provider-loading and account security results through one shared settings toast, including retryable errors and repeated notifications.
- Show sign-in failures and rate-limit warnings as dismissible toasts, with retry countdowns on sign-in buttons.
- Apply CommonJS-compatible import linting to standalone Node test fixtures while retaining the TypeScript import rule for application code.

### 2026-11-04

#### Added

- Documented the instance provider selection and refreshed shared AI transport dependencies (2026-11-04).

- Initial self-hosted dashboard and reusable UI components source snapshot with independent setup and automated checks.
- MIT license, contribution and community guidelines, security/support policies,
  issue forms, a pull-request checklist and dependency-update configuration.
- Pull-request title validation matching the review engine's commit notation.

#### Changed

- Standardized the initial commit subject and future commit/PR titles as
  `type(scope): short imperative description` (maximum 72 characters).
- Included the approved MIT license and contribution documentation in packaged
  source artifacts; removed the provisional license marker.

#### Fixed

- Show an informational empty-repository state and first-commit guidance instead of an indexing failure.
