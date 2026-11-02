# Remediation progress — first implementation batch

Updated November 1, 2026 (America/Chicago). **Status: NOT READY.** This is a tested implementation milestone, not completion of the remediation plan or release authorization.

## Checkout and baseline

- Working checkout: `C:\Users\geare\Documents\ChatGPT\Swole House Code Review\remediation`.
- Branch: `codex/ios-release-readiness`, based on `93bd1f356cee4708fafb44850b4c8a4312a390bd`.
- Original repository remains at `C:\Users\geare\Desktop\Jobs\Swole House\codex_review\Workout-App-Codex`; all 69 audited file hashes were rechecked and remain unchanged.
- Changes are local and reviewable. No commits/pushes, database migrations, live backend mutations, credential operations, EAS production builds, TestFlight uploads or submissions were performed.

## Implemented and locally verified

| Findings | Changes | Evidence / remaining limit |
|---|---|---|
| R001 | Immutable account scopes; per-account workout/profile/exclusion/reset keys; account IDs in feedback/custom-exercise/admin query keys; cache cancellation/clear and navigation remount on identity changes; session identity verified before network writes. Pending run handoff rejects previous-account data, including delayed native stop dialogs. | Account-switch, late-response and run-handoff regressions pass. React/native UI and hosted authorization integration still require testing. |
| R001 legacy migration | Existing device-wide keys are left untouched and are never automatically uploaded or assigned to an account. History explains that earlier local data is preserved separately. Existing server history remains readable, including the old workout format. | Owner decision resolved: preserve unowned data without import or reassignment. No legacy content was copied, deleted or attributed to another user. |
| R003 / R018 | Serialized per-account writes; durable pending PUT/DELETE queue, revision-specific acknowledgements and deletion tombstones while pending. Offline state survives repository recreation. Stale GETs and in-flight acknowledgements cannot erase newer edits. History reads local data first and shows pending changes/retry errors. | Local/offline regressions pass. This does not establish a global multi-device conflict policy or server-side deletion tombstones. No hosted API integration test executed. |
| R004 | Versioned SecureStore chunk manifests, publish-after-write generations, serialized operations, byte-based Unicode chunking, old-generation cleanup and logout tombstones. Web storage failures are no longer silently swallowed. | Six session failure/concurrency tests pass. Legacy orphan cleanup is deliberately bounded to 128 chunk indexes; arbitrary older unindexed fragments beyond that bound cannot be discovered by SecureStore's API. Actual Keychain behavior remains unverified. |
| R005 | Defined replacements for hidden running prerequisites; depleted/empty pools fail before persisting invalid workouts; short circuit pools keep valid blocks/rounds. Rebalancing avoids duplicate/hidden additions. Generator errors reset loading and provide a message. | Five generator tests pass, including 152 default combinations. Full exclusion UX, restoring removed built-ins and all feature/device combinations remain follow-up work. |
| R026 | Extracted pure PR calculations; weights/distances/pace normalized for comparison while original units remain available for display. | Mixed-unit and reset regressions pass. UI rendering not device-tested. |
| R027 | One canonical exercise/superset order; conversion preserves every existing pair and selected display position. Invalid historical order metadata falls back to all persisted entries rather than dropping items. | Three order tests pass, including repeated conversions and malformed order metadata. |
| R006 | SDK 54 native module alignment: clipboard 8.0.8, sharing 14.0.8, maps 1.20.1, keyboard-controller 1.18.5. Supported SDK 54 patches installed; Expo now resolves 54.0.38, React remains 19.1.0, RN remains 0.81.5. | Online `expo install --check` passes. No SDK major upgrade or native compilation performed. |
| R006 / R025 | Existing HTTPS development asset patch ported to expo-asset 12.0.14 and applied successfully; package declared directly. Babel preset and esbuild declared directly after bundling exposed reliance on transitive hoisting. | Patch application, iOS JS export and server compile pass. Clean CI/native install still needs independent execution. |
| R010 | Removed Replit automatic post-merge hook. Optional setup script uses npm ci and does not run migrations. | Unsafe automatic path removed. Legacy `scripts/migrate.ts` still contains destructive SQL and must not be run; a versioned replacement remains to be designed against actual schema. |
| R013 / R017 / R018 | iOS Open Settings uses Linking.openSettings; run countdown clears on unmount. Supabase refresh follows native AppState; logout errors propagate. Generator/run/profile/history save/load failure handling improved; deletion no longer falls back to localhost. | Source/static checks pass. Background GPS/timer/draft/auth recovery and full startup failure paths remain unresolved. |
| R021 | Removed response-body capture from request logger; log route template/status/duration rather than response fragments/user resource IDs; generic HTTP error response. | Existing raw exception/upstream admin logging still needs a full redaction/retention review. No production log inspection executed. |
| R022 | .easignore excludes the historical ZIP, attachments, audit evidence and generated verification outputs. Originals retained in source history. | No EAS upload inventory or IPA asset inspection executed. |
| R023 | Mail client instantiated only when configured; feedback skips unavailable mail and admin mail tools return unavailable. | Type checked and server compiled; optional-mail runtime integration still to test in isolation/staging. |
| R019 | Node test runner + existing tsx, npm test/typecheck scripts and quality workflow with install/patch/type/lint/test/Expo/security gates. | 31 tests pass locally. CI was not pushed/run; its security gate will currently fail on unresolved high advisories. |

## Checks actually completed

Host: Windows, Node 24.21.0 / npm 11.19.0. CI is configured for Node 22 but has not been executed. Dependencies installed with lifecycle scripts disabled; the reviewed expo-asset patch was then applied explicitly.

| Check | Final observed result |
|---|---|
| `node node_modules/tsx/dist/cli.mjs --test --test-reporter=tap tests/*.test.ts` | **31 passed, 0 failed**; [TAP evidence](evidence/remediation-tests.tap). |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | Exit 0. Initially exposed 12 baseline errors; nullable share refs, Express params and implicit types corrected. |
| `node node_modules/eslint/bin/eslint.js .` | Exit 0; **0 errors, 28 warnings**. No broad formatting or global rule suppression. Audit evidence excluded from application lint; one documented manual-retry dependency exception. |
| `node node_modules/patch-package/index.js --error-on-fail` | expo-asset 12.0.14 patch applied. |
| Online `node node_modules/expo/bin/cli install --check` | Exit 0; dependencies up to date. |
| Expo Doctor 1.21.5 | Final run: **17/18 checks passed**, schema check could not complete because Expo API TLS connection failed. An earlier online schema check conclusively reported nonsquare iOS icon and Android foreground icon (both 350×356). Those assets are unchanged and unresolved. |
| `expo export --platform ios --output-dir .verification/ios-export` | Exit 0; Hermes JS bundle **5.52 MB**, with assets. Uses obvious placeholder public API/Supabase values; not usable release configuration. This is **not an IPA/native production build** and proves no signing or device behavior. |
| `npm run server:build` | Exit 0; 31.2 KB server bundle. Server not started; no database connection/migration or email send performed. |
| `git diff --check` | Exit 0; no whitespace errors. Windows line-ending conversion notices remain informational. |
| Online npm lock audit | **47 advisory entries: 0 critical, 19 high, 26 moderate, 2 low**. See important correction below. |

Generated full logs/bundles are under ignored `.verification/`. Stable scan/test evidence is copied into `evidence/`. No coverage percentage, native test, TestFlight or App Review result is claimed.

## Important correction: dependency security assessment

The initial audit command returned zero advisories. An explicitly online rerun against the **unchanged original lockfile** returned **61 entries (3 critical, 27 high, 29 moderate, 2 low)**. The cause of that discrepancy is not established; the original zero result must not be relied on as a release security result. [Original-lock online evidence](evidence/baseline-online-npm-audit.json).

SDK alignment/patch updates reduced the count to 49; targeted compatible transitive updates then reduced it to **47 with no npm-rated critical entries**: proxy-addr 2.0.7 → 2.0.8 and shell-quote 1.8.3 → 1.12.0. These remain within their parent dependency ranges. The [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) and [shell-quote advisory](https://github.com/advisories/GHSA-w7jw-789q-3m8p) describe the relevant issues; runtime exploitability depends on actual call paths, inputs and configuration.

**R028 — HIGH — Remaining dependency advisories require explicit triage and remediation.**

- **Files/evidence:** package-lock.json, especially body-parser entry around 6073, decode-uri-component around 6914, drizzle-orm around 7189 and zod around 16803; exact installed paths/ranges/advisory URLs are captured in [remaining-advisories.json](evidence/remaining-advisories.json) and [raw audit](evidence/remediation-npm-audit.json). Lockfile line numbers can shift on future installs.
- **Problem:** 19 high-rated dependency entries remain, including both actual advisories and packages inheriting dependency severity. Counts are package entries, not 47 separately proven application vulnerabilities. Server runtime, native runtime, CLI/dev and unused paths need separate classification.
- **Impact:** Potential denial of service/security exposures in reachable paths; current release cannot be called dependency-secure. No exploit against the app was executed or confirmed.
- **Recommended fix:** Map each advisory to callers and trust boundaries; patch compatible dependencies in small groups, verify query/Express behavior, and evaluate narrowly scoped replacements/overrides only with tests. For fixed framework/ORM/schema versions outside the present ranges, prepare a separate compatibility-tested change. Do not automatically run npm audit fix --force.
- **Risk:** Medium/high. Suggested fixes include Expo 58 upgrades and even an Expo 51 downgrade, neither of which is an acceptable automatic action. Drizzle/Zod changes need server/schema compatibility review.
- **Verification:** Review advisory conditions and dependency paths, add focused exploit-regression fixtures where reachable, rerun online audit, Expo diagnostics, unit/integration/bundling checks and eventual native/device checks.
- **Blocks submission:** Yes, security review/remediation gate. Advisory severity alone is not proof of exposure, but unresolved high entries require evidence-backed dispositions.

There are now **27 original findings plus follow-up R028**. Original audit severity totals remain a historical snapshot, not a current count of unremediated defects.

## Remaining gates and decisions

1. **Legacy ownership — resolved:** the user requires creator ownership. Unowned device-wide records remain preserved/unassigned and inaccessible to other accounts; no user-claimed import flow is planned.
2. **Running behavior — resolved and implemented locally:** background/locked run/walk tracking is approved. Native configuration, global task, persistent owner-scoped drafts and timestamp timing are implemented. Native build and device/battery validation remain required. See ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md.
3. **Hosted deletion/authorization:** R002/R011 require the real application schema, Data API exposure/RLS/grants/triggers, staging test access and retention/deletion policy. No account-data deletion implementation was changed prematurely; Auth-only deletion is still a known blocker. No production mutation is authorized by these test results.
4. **Cross-device conflicts:** local queue fixes do not choose a global conflict policy or implement server revisions/deletion jobs. Define and test the policy before closing R003 fully.
5. **Other open work:** remaining advisory paths; policy/support links and retention wording; square approved artwork; explicit native permissions/manifests; auth recovery/deep links/startup; run draft/background behavior; accessibility; API input/size/rate limits; operational backup/log retention; measured performance and cleanup.
6. **Release identity/environment:** confirm bundle-ID ownership, Expo project, production API/Supabase environment, Apple team and EAS profiles. No private values should be pasted into documentation.
7. **Build/device gates:** separate production-build authorization, TestFlight upload approval, actual device matrix and separate submission authorization still apply.

## Reviewable logical groups / suggested commit messages

No commits were created. Suggested groups for subsequent review/commits:

1. `fix(auth): isolate account persistence and secure session lifecycle`
2. `fix(sync): persist offline mutations and reject stale responses`
3. `fix(workouts): validate exercise pools and preserve superset order`
4. `fix(profile): compare personal records in canonical units`
5. `fix(expo): align SDK 54 dependencies and explicit build tools`
6. `fix(operations): separate migrations and reduce request-log exposure`
7. `test(release): add regression and static quality gates`

The branch remains a working remediation branch. Do not deploy its placeholder bundle or treat this milestone as approval to publish.

## November 1 — Account ownership and background-run implementation

The creator-ownership and background/locked tracking decisions are resolved. Explicit workout owner metadata, authenticated server owner stamping, owner-qualified SQL mutations, generator transition guards, persistent run drafts, headless GPS recording, safe pause/finish/sign-out behavior, stable-ID summary recovery, permission explanations and a confirmed foreground-only fallback are implemented. See [feature implementation and device gates](ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md). This supersedes earlier foreground-only/run-handoff notes. Validation is recorded in TEST_REPORT.md and evidence/background-run-verification.json. Other release blockers are unchanged.

## November 2 — Beta preparation follow-up

EAS profiles/preflight and environment/project config are implemented; com.forge.app remains unchanged. The app uses a square opaque icon and explicit intended permissions. Startup has timeout/retry and safe config failure handling. PKCE redirects and client password recovery are implemented, with secure verifier persistence and device-bound Keychain availability after first unlock. All 19 former high entries were triaged; compatible updates reduce high entries to 7. Generated export directories are excluded from lint, retaining source rules. Current checks: 61 tests, TypeScript, ESLint 0 errors/23 warnings, Doctor 18/18, 38 SDK-managed version matches, introspection and local iOS/web exports. These supersede earlier milestone counts; see BETA_PREPARATION_UPDATE.md and DEPENDENCY_TRIAGE.md. Real project/environment, hosted auth, native build/device and other release blockers remain open. No release/production action occurred.
