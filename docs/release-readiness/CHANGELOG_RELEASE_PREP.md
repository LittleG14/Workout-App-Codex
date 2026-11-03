# Release preparation changelog

## October 30, 2026 — Audit milestone only

- Read the primary repository at `C:\Users\geare\Desktop\Jobs\Swole House\codex_review\Workout-App-Codex`, baseline `93bd1f356cee4708fafb44850b4c8a4312a390bd`.
- Created seven requested audit/release-planning Markdown documents under the separate writable review workspace's `docs/release-readiness/`.
- Added audit-only inventory, import/dependency/environment analysis, bounded secret scans, archive inventory and isolated source reproductions in `evidence/`.
- Executed lockfile-only vulnerability audit; recorded missing-tool diagnostics and all limits in TEST_REPORT.md.
- Reproduced ten defects and sampled 380 default-pool generator cases without contacting application services.
- Consulted official Apple/Expo/Supabase documentation and versioned Resend source; documented 27 findings and controlled remediation sequence.

**Application changes: none.** No package install/upgrade/removal, dependency-tree modification, native regeneration, schema migration, production data change, credential rotation, Apple credential modification, build/upload/submission or external publication. No remediation commit or dedicated remediation branch was created because application remediation has not begun.

## Remediation entries — pending approval

For each approved logical batch, add date, branch/commit, finding IDs, changed files, behavior/rationale, migration/rollback notes, checks actually executed/results and unresolved risks. Reconcile the release summary with those entries. Never mark a proposed change completed before implementation and verification.

## November 1, 2026 — First approved implementation batch

- Created a separate checkout and codex/ios-release-readiness branch; original 69-file baseline remains unchanged.
- Implemented account-scoped persistence/query identity/request guards and run handoff, durable local sync revisions/tombstones, session-generation storage, generator pool guards, canonical superset order and mixed-unit PR comparisons.
- Retained legacy global data without assigning or uploading it; recovery/import decision remains pending. Added History notice/pending-sync/error states.
- Aligned SDK 54 native modules/patches, declared the Babel preset and esbuild explicitly, and ported the reviewed development asset patch to expo-asset 12.0.14. Expo resolves 54.0.38; React/RN unchanged.
- Removed automatic post-merge migration invocation, reduced response logging, made missing mail configuration nonfatal, added local failure handling and native refresh/settings/countdown fixes.
- Added 31 regression tests and a quality workflow; all local tests and TypeScript pass. Lint: 0 errors/28 warnings. Online Expo dependency validation, local iOS JS export and server compilation pass. No IPA/device/signing/release verification claimed.
- Corrected the security assessment: online unchanged baseline has 61 advisory entries. Working tree is down to 47, with npm-critical entries reduced from 3 to 0. High advisories remain; added follow-up R028 and saved scan evidence.
- Added EAS upload exclusions without deleting the historical archive. No production services/data/credentials, Apple signing, builds/uploads/submissions or publication changed; no commits or pushes created.

See REMEDIATION_PROGRESS.md for per-finding status, implementation risks, exact evidence and suggested logical commit groups. The legacy destructive migration script remains unsafe to run and is not a release-validation command.

## November 1 — Approved account ownership and background running

- Stamp persisted workouts with the authenticated owner; reject foreign-owner writes; override owner metadata server-side and qualify private SQL operations by owner and ID. Guard workout generation across its asynchronous delay. Preserve unknown-owner legacy records without import.
- Add SDK 54 TaskManager 14.0.9 and global background-location registration, CNG location permission/background modes, and Android foreground-service settings. Remove the unnecessary automatically added iOS fetch mode.
- Persist private run drafts and stable run IDs; use timestamp timing and continuous GPS segments; serialize controls/batches; preserve drafts and stop tracking on account transitions, native/storage failures and pause/finish.
- Add permission explanations, denied/unavailable background fallback requiring explicit acceptance, app-open mode labeling, poor-GPS guidance, recovery through setup, and stable-ID save retries.
- Add regression coverage and native-config assertions; update privacy inventory and device checklist. No production services, credentials, native builds or release uploads were changed. See ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md and TEST_REPORT.md.

## November 1–2 — Beta configuration, startup and account recovery

- Add EAS preview/simulator/TestFlight/production profiles, remote build-version policy, clean-source requirement, optional actual project/owner config and read-only release preflight. Preserve com.forge.app; remove the Replit router origin.
- Add a sibling square RGB icon, preserve original artwork, and explicitly suppress unused native image-picker/biometric permissions after source review.
- Bound session/font startup, hide failed splash, render a system-font retry screen and prevent module-import crashes on missing service config. Bound Supabase requests and recovery operations.
- Add native Expo-backed PKCE crypto, exact auth callback handling, signup/email-change redirects, forgot-password/reset screens, verified owner-bound recovery authority and token-bound password updates. Keep credentials/verifiers in SecureStore with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY for new native writes; preserve web localStorage behavior.
- Update compatible dependency branches and add narrow brace-expansion/PostCSS overrides. Record all 19 prior high-entry dispositions, 7 remaining highs and the unfiltered final scan.
- Expand tests to 61 and exclude generated verification bundles from ESLint. No Apple credentials, native builds, uploads, hosted auth changes, real emails/passwords or production data were modified.

Suggested review commits: fix(release): configure beta profiles and validate public build environment; fix(ios): supply square icon and scope native permissions; fix(auth): recover startup and implement PKCE password reset; fix(deps): patch compatible advisories and document remaining exposure. Changes remain uncommitted.
