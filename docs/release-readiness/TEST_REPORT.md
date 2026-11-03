# Audit validation report

> November 1 remediation update: implementation is underway in the dedicated checkout. The initial zero-advisory result is superseded by an online baseline result of 61 and a current result of 47 (0 critical). See [remediation progress](REMEDIATION_PROGRESS.md) for tested fixes, limits, and follow-up R028. The original audit below describes the baseline commit.

Date: October 30, 2026. Source commit: `93bd1f356cee4708fafb44850b4c8a4312a390bd`.
Host: Windows / PowerShell; Node **v24.21.0**, npm **11.19.0**. Replit declares Node 22; this audit host is not a reproduction of the deployment toolchain. No packages were installed or updated.

## Executed checks

| Check / command | Result | Meaning and limits |
|---|---|---|
| `git status --short`, `git log -1`, `git ls-files`, `rg --files --hidden` excluding Git/generated/dependency directories | Initial tree clean; 69 tracked files, 46 JS/TS/TSX files | Whole main-tree inventory captured with SHA-256 in evidence. |
| Read project instructions/configuration/source; static literal import/dependency/environment graph | Completed; no discovered static import cycles; no package.json/lock root range mismatches | Dynamic/native/config references considered separately. Not a compiler or dependency solver. |
| `git rev-list --count --all` / reachable text blob scan | 122 commits, 268 unique eligible text blobs; zero candidate pattern hits | Heuristic, no secret values printed. Excludes unreachable objects, binary/LFS/remote state and nested ZIP history. |
| ZIP central-directory inventory and selected text scan | 413 entries; 35 text entries scanned, zero hits in narrower token/key/credential-URL patterns | Includes old Git repository and Replit binary state; those nested histories/binaries remain unscanned. |
| PNG header inspection plus visual inspection of icon | Icon 350×356, alpha-capable PNG; splash is exact duplicate; logo 197×129 | Nonsquare icon source confirmed. Actual alpha pixels/generated archive not validated. |
| `npm ls --depth=0 --offline` | Exit 1, ELSPROBLEMS; direct dependencies missing | Expected in source-only snapshot, not a dependency compatibility verdict. |
| `npm audit --package-lock-only --ignore-scripts --json` | Exit 0; **0 known advisories**: info/low/moderate/high/critical all 0 | Registry lockfile scan; 867 prod, 323 dev, 122 optional, total 1,228 entries in metadata. No installed tree or application-code vulnerability coverage. |
| `npm exec --offline --no -- expo-doctor` | Exit 1, ENOTCACHED | Expo Doctor not executed. No package installation attempted. |
| `npm exec --offline --no -- expo install --check` | Exit 1, ENOTCACHED | SDK diagnostic not executed. Native compatibility assessed from official SDK 54 map instead. |
| `npm exec --offline --no -- tsc --noEmit` | Exit 1, ENOTCACHED | TypeScript not executed. npm's executable lookup queried the `tsc` package; **do not install that package**. After installing project dependencies, use its declared TypeScript binary. |
| `npm exec --offline --no -- eslint .` | Exit 1, ENOTCACHED | ESLint not executed. No lint pass claimed. |
| Audit-only unmodified-source harness | Ten defects reproduced; 380 baseline generator samples passed | Uses Node's experimental TypeScript erasure and injected local storage/network/Keychain mocks. No live service, native UI or native module execution. |
| Official documentation review | Apple guidelines/upload floor/privacy/deletion; Expo SDK map/plugins/permissions/EAS; Supabase lifecycle; locked Resend source | Current pages consulted. SDK 54 docs URLs redirected to latest, so version-specific dependency/plugin conclusions use the official SDK 54 source branch. |

Some npm commands could not write optional debug logs to the default cache directory in the sandbox. This did not prevent the successful lock audit. Offline executable lookup failures were caused by absent packages/cache; no online package installation was attempted, as instructed. The Git-launching Node audit harness initially failed `spawnSync git EPERM`; it was rerun via the required elevated execution mechanism and completed. No application source write was needed.

## Reproductions against actual source logic

The [harness](evidence/audit-checks.cjs) loads actual source from the supplied root, erases TypeScript, replaces imports with explicit mocks and calls exported/internal functions. Its environment uses placeholder tokens and `https://audit.invalid`; fetch is mocked. Source code is not rewritten on disk. The harness's defect booleans indicate **failures found**, not acceptance tests passed.

| Reproduction | Result | Findings |
|---|---|---|
| Seed local workout as A, supply B token, call syncLocalWorkoutsToServer | A workout POSTed as B | R001 |
| Delete while mock network offline; reconnect and GET original server record | Deleted workout returns | R003 |
| Edit while mock network offline; reconnect and GET old server record | Local edit overwritten | R003 |
| Promise.all of two saveWorkout calls from empty storage | Only one record remains | R018 |
| SecureStore large session → short session → delete | Two old chunk keys remain | R004 |
| Hide Easy Pace Run, generate 30-minute running workout | Undefined exercise entries | R005 |
| Hide all circuit exercises, generate 60-minute EMOM | Non-finite round count | R005 |
| Generate superset workout; convert another exercise before reordering | Persisted superset count exceeds display-order slots | R027 |
| Compare 100 kg and 220 lb in actual profile PR function | Lighter 220 lb selected | R026 |
| Compare 5-mile run at 8 min/mile with 7-km run at 6 min/km | Slower/shorter km record wins both comparisons | R026 |
| Five iterations × all 19 non-GPS category/subtype combinations × four durations, default pools, core/superset flags enabled | 380 cases pass basic ID/nonempty/defined-exercise assertions | Partial baseline only; random sampling, no exhaustive correctness proof |

Full results: [reproduction-results.json](evidence/reproduction-results.json). No current defect is fixed. Reproductions should become regression assertions of correct behavior during remediation; do not run this as a release test and interpret defect reproduction as success.

Reproduce in this review workspace with Node 24+:

```powershell
node docs/release-readiness/evidence/audit-checks.cjs 'C:\Users\geare\Desktop\Jobs\Swole House\codex_review\Workout-App-Codex'
```

`--quick` skips the historical scan and preserves its existing evidence file. Consequently its console history counts are zero for that invocation; the complete first scan's 268-blob result remains in `secret-scan.json`. Requires filesystem read access, Git subprocess capability and permission to write evidence beside the harness. Node emits an experimental stripTypeScriptTypes warning. No dependencies/network needed by this harness.

## Evidence files

- [repository-inventory.json](evidence/repository-inventory.json): primary source snapshot, commit, hashes/sizes/line counts.
- [static-analysis.json](evidence/static-analysis.json): literal imports, circular-check result, environment references, direct locked versions and candidate unused entry points.
- [secret-scan.json](evidence/secret-scan.json): patterns, bounded scope and redacted location-only candidates (none).
- [archive-inventory.json](evidence/archive-inventory.json) and [archive-secret-scan.json](evidence/archive-secret-scan.json): nested archive inventory and text-scan limits.
- [reproduction-results.json](evidence/reproduction-results.json): actual isolated checks.

## Not executed / no pass claimed

No TypeScript compilation, lint, Expo Doctor/install validation, clean npm install, patch application, Metro production bundle, generated native config inspection, native compile, simulator/device test, accessibility audit, network capture, battery/memory measurement, staging API integration, RLS/grant inspection, real deletion, email send, database migration, EAS production build, signing validation, TestFlight processing or App Review submission was completed. No automated test coverage percentage is available.

## Follow-up validation after approval

1. Install the baseline in the dedicated checkout, without invoking Replit post-merge hooks/migrations; record Node/npm and peer conflicts before fixing them. Then use declared TypeScript/ESLint binaries, Expo diagnostics and lock audit. Review any install-time patch error.
2. Add focused regression tests for all ten reproduced behaviors; integration tests for owner-scoped CRUD, duplicate IDs, app-data deletion, partial failures, validation and rate/email limits. Use a disposable DB and fake mail service, never production data.
3. Add auth/provider and query-cache transition tests, recovery/callback tests, storage corruption/failure tests and run lifecycle/subscription cleanup tests. Include excluded/custom-only generator pools, circuit rebalance and saved domain invariants.
4. Render/test critical screens, navigation, loading/error states and sharing flows with appropriate Expo-compatible component tools. Test API failures and delayed responses, not just snapshots of implementation.
5. Execute preview/production native build and the manual matrix in [IOS_RELEASE_CHECKLIST.md](IOS_RELEASE_CHECKLIST.md), after the applicable authorizations. Record exact artifacts/devices and reproducible failures. Expand testing based on failures/changes rather than repeating unrelated suites indefinitely.

A green static check or successful build cannot replace the unexecuted device, privacy and operational checks.

## November 1, 2026 — Remediation verification

Against the working branch: 31/31 local regression tests pass; TypeScript passes; ESLint passes with 0 errors/28 warnings; the expo-asset patch applies; online Expo dependency check passes; iOS Hermes JavaScript export succeeds (5.52 MB); Express compilation succeeds. Expo Doctor's last run passed 17/18 checks, with schema validation blocked by an Expo API TLS failure; previously confirmed nonsquare icons remain unchanged. No native build or device tests were executed. The online untouched-baseline audit reports 61 entries; the working lockfile reports 47, with 0 critical and 19 high. This supersedes the initial zero-advisory result. Full commands/evidence and all limits are in REMEDIATION_PROGRESS.md. CI is defined but was not run and will fail its security gate until remaining high advisories have been resolved/dispositioned.

## November 1 — Account/background-run follow-up

45/45 repository regression tests pass. TypeScript passes; ESLint reports 0 errors and 27 warnings. Expo SDK compatibility passes with expo-task-manager 14.0.9. Native config introspection verifies only iOS `location` mode and explicit location descriptions. The local iOS Hermes export succeeds (5.56 MB, placeholder public configuration); Express compiles (31.5 kB) without starting the server. The online npm audit remains 47 entries (0 critical, 19 high, 26 moderate, 2 low).

New tests cover timestamp elapsed time with suspended JS, persistent/headless batches, duplicate/stale/inaccurate fixes, poor-GPS recovery, pause/resume route/time, account boundaries, absent sessions, native interruptions, fixed-ID finish/save retry, permission/storage failures, corrupted drafts, orphan tasks and explicit workout ownership. Windows sandbox worker spawning initially failed with EPERM; tests/export succeeded after authorized execution outside the sandbox. No source was changed to bypass these checks.

Commands and result metadata: evidence/background-run-verification.json. Raw tests and native-config summaries are retained beside it. No native build, device/simulator, real lock-screen, battery, hosted API/RLS, privacy-network trace or TestFlight test was performed. The 8-part device matrix in ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md remains required. The original 69 file hashes were rechecked and unchanged.

## November 2 — Final beta preparation verification

**61/61 tests pass; TypeScript exits 0; ESLint exits 0 with 23 warnings; Expo Doctor 1.21.5 passes 18/18; Expo SDK dependency validation passes (38 matching SDK-managed direct packages).** Native configuration introspection, iOS JavaScript export, web/CSS export, server compilation and the expo-asset patch pass. No native build/device test was executed. Real release configuration preflight intentionally exits 1 until the real public environment/project UUID is supplied.

New coverage includes bounded startup failures/retry, safe config validation/preflight, callback allowlisting/token rejection, PKCE code-exchange deduplication, recovery expiry/account-switch/replay/failure handling, persisted verifier recreation/cleanup, Express JSON/compression/size behavior, PostCSS transforms and square/opaque icon structure. These tests use fakes/local fixtures and a localhost-only Express server; no hosted email/account/database action occurred.

The first final lint pass scanned the generated minified web bundle under .verification and reported generated-code errors. Excluding that temporary artifact directory corrected the check; no application rule was disabled. Windows process/network checks used authorized execution where required.

Current audit: 61 package entries (0 critical, 7 high, 52 moderate, 2 low). Compared with the previous working scan, unique advisory URLs fell 52→16 with no new URLs; do not conflate advisory count with affected-package count. Detailed dispositions and command/evidence metadata are in DEPENDENCY_TRIAGE.md and evidence/beta-verification.json. CI was not run remotely and its unchanged high-audit gate still needs resolution.

Native lock-screen/Keychain, live Supabase redirect/SMTP/delivery, actual password-reset/email-change, signing/build/archive and hosted API authorization/deletion tests remain unexecuted. See BETA_PREPARATION_UPDATE.md for the required manual configuration and testing.
