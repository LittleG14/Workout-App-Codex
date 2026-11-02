# Prioritized remediation plan

Status: **APPROVED — IMPLEMENTATION UNDERWAY**. See [remediation progress](REMEDIATION_PROGRESS.md) for completed work and required product decisions. Baseline, scope, evidence and finding details are in [AUDIT_REPORT.md](AUDIT_REPORT.md). The plan remains the roadmap; the first implementation batch is complete locally. This document proposes changes; it does not authorize a build, credential change, backend mutation, upload or submission.

## Sequence and acceptance criteria

| Order | Findings | Proposed change | Complexity / risk | Dependencies and acceptance |
|---|---|---|---|---|
| 0 | All | Preserve baseline and create `codex/ios-release-readiness` in a writable dedicated checkout. Record source hashes and approved scope. Inventory staging vs production resources. | Small / low | User approves audit/plan. Never run existing post-merge migration. Baseline recoverable; no unrelated changes. |
| 1 | R001, R004, R018 | Add minimal regression harness for account boundaries, session adapter and serialized local writes. Implement per-account persistence/query identity, transition cancellation, cleanup and safe session representation. | Large / high | Owner decides ownership/migration of legacy shared data. Old data backed up locally; no silent reassignment. A/B switch, delayed responses, restart, corrupt session and concurrent saves pass. |
| 2 | R002, R010, R011 | Inspect staging/deployed policies read-only; replace destructive migration workflow; design staged/idempotent account-data deletion and verified database privileges. | Large / high | Owner confirms database ownership, backup/retention obligations and staging access. Separate approval for any production DB mutation. Anonymous/A/B authorization tests pass; deletion removes every intended data category and supports retry. |
| 3 | R003, R015, R018 | Implement durable per-account mutation queue/tombstones and small revision policy; add shared runtime schemas and explicit route payload limits. | Large / medium-high | Account boundaries established. Owner resolves cross-device conflict behavior. Offline edit/delete/create survives restart, retries once safely, and cannot revive tombstones. Representative multi-hour run syncs or surfaces a clear size error. |
| 4 | R005, R026, R027 | Guard generator prerequisites and empty/hidden/custom-only pools; fix superset ordering and normalize PR comparisons; preserve all categories and exclusion preferences. | Medium / medium | Reproduction tests first. Default matrix, exclusions, replacements, mixed units, supersets, rebalancing and rendered/shareable results pass. No silent feature removal. |
| 5 | R006, R007, R012, R023 | Install locked baseline only after approval; align native dependencies within SDK 54; establish public/server environment contract, optional-mail behavior, explicit native permissions and EAS config. | Medium / medium | EAS account/project and production API ownership confirmed. Node/npm recorded; lockfile diff limited. Doctor/typecheck/lint pass or each remaining warning has an evidence-backed disposition. No major Expo upgrade unless concrete diagnostic/build evidence requires one. |
| 6 | R013, R014, R016, R017 | Fix settings recovery and async cleanup; timestamp timers; recover run drafts; implement agreed auth recovery/callback and lifecycle behavior. | Medium-large / medium | Product decisions below. Simulated errors then device tests; background/foreground and cold/warm auth links pass without duplicate listeners or lost drafts. |
| 7 | R008, R009, R021, R024 | Add policy entry points; publish approved retention/processor text; replace icon from approved artwork; redact logs; label controls and add accessible gesture alternatives. | Medium / low-medium | Owner supplies policy decisions and brand source. Signed-out/in policy accessible, real deletion matches claims, icon/native artifact valid, VoiceOver completes essential flows. Publishing any external site is a separate action. |
| 8 | R019, R020, R022, R025 | CI, focused regression tests, measured performance/index/pagination fixes; controlled dependency/archive cleanup; corrected runbook. | Medium / medium | Preserve backup before archive removal. No package removed based only on a missing import. Clean checkout can install and validate. Bundle/upload inventory excludes unnecessary historical state. |
| 9 | All release gates | Production-like preview validation, approved production EAS build, archive inspection, TestFlight and device QA. | Medium / release risk | Separate explicit production-build authorization. Then separate TestFlight upload approval. Record actual build IDs, toolchain, test matrix and unresolved issues. |
| 10 | All | Submit specified validated build to App Review. | Manual / publishing action | Separate explicit submission authorization; checklist complete; no unresolved material blockers; reviewer account and backend operational. |

Complexity means relative engineering scope, not a promised schedule. Large changes span persistence/auth/server boundaries; small changes are localized. Findings marked conditional must be resolved with evidence or an explicit justified disposition, not silently dropped.

## Product and infrastructure decisions

1. **Legacy data ownership — resolved:** all new private data belongs to its creating account. Unowned device-wide records remain preserved and unassigned without import. Profiles/preferences are account-scoped.
2. **Offline conflict rules:** Define what happens when two devices edit/delete the same workout. Recommended starting point: revisions with explicit pending mutations and persistent deletion tombstones; avoid timestamps alone as a universal conflict solution.
3. **Run lifecycle — approved:** implement background/locked run/walk recording with native permissions, owner-scoped draft recovery and accurate suspension timing. Implemented locally; native/device/privacy/battery verification remains. See ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md.
4. **Authentication access:** Confirm guest access policy. Locally generated workouts are behind a login gate; assess Apple's account-access requirement before changing navigation. Confirm email-only login is intended; do not add social login solely because old docs mention it.
5. **Deletion/retention:** Specify deletion deadline, backup expiry, processor/email retention and any justified records retained. Confirm which database hosts application tables and whether auth deletion triggers already exist.
6. **Identity and artwork:** Confirm `com.forge.app` is owned and intentionally used. Prefer the established ID if already registered; changing an established ID creates a separate app. Obtain approved square source art and confirm rights.
7. **Operations:** Confirm Replit remains production backend, custom HTTPS domain, availability/backup/monitoring ownership, Supabase region/project and Resend verified sender. A static marketing page cannot replace Express.

## Proposed EAS configuration contract

This is a specification for later implementation, not configuration installed by this audit.

| Profile | Intended behavior |
|---|---|
| development | Internal development client; add SDK-compatible expo-dev-client if approved; staging API/Auth; debug tools permitted. |
| preview | Internal/ad hoc device build (registered devices required for that iOS distribution) or deliberately configured TestFlight preview; production-like behavior against staging; no privileged keys in app. |
| production | Store distribution; explicit production environment; verified Expo project ID and owned bundle identifier; automatic build-number increment with a documented version source; qualifying Xcode 26+ image proven compatible with chosen SDK. |

Public mobile values: `EXPO_PUBLIC_DOMAIN` as a hostname under the current contract (no protocol/path), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Validate them before bundling. They are inspectable client configuration, not privileged secrets.

Server only: `SUPABASE_CONNECTION_STRING`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, admin recipient/allowlist, runtime port and approved CORS origins. Keep these out of EXPO_PUBLIC variables, EAS app bundles, reports and client config. Replit development/proxy variables must not be needed by a standalone production binary. Standardize current inconsistent URL helpers.

Do not configure EAS Update until there is an actual requirement. If adopted, use a native-compatible runtimeVersion strategy (for example fingerprint), explicit preview/production channels, staged rollout and tested rollback. A native dependency/permission change requires a new binary; the Replit Expo Go bundle mechanism is not a substitute.

## Change controls

Implement one logical batch at a time on the dedicated branch, keeping UI/design/features intact. Suggested commits: `fix(auth): isolate account persistence and session cleanup`; `fix(account): delete associated application data safely`; `fix(sync): retain offline mutations and deletions`; `fix(generator): validate excluded exercise pools`; `fix(ios): align SDK dependencies and release configuration`; `test(release): cover account and offline regression paths`; `docs(release): record verified build and device results`.

Each batch updates [CHANGELOG_RELEASE_PREP.md](CHANGELOG_RELEASE_PREP.md), captures relevant tests and leaves a reviewable diff. Never invoke migrations on production as a test. Stop for a concrete product decision where behavior or existing data is at risk. Do not commit, rotate credentials, change Apple signing or publish without the applicable authorization. Audit approval has been received. Legacy ownership is resolved: keep unowned data unassigned without import. Background/locked run tracking is approved and implemented locally; native validation and release approvals remain separate.

## Approved ownership rule (November 1)

All new private records belong to their creating authenticated account. User-confirmed import cannot establish ownership of untagged legacy records; preserve them unassigned and inaccessible to other accounts. Known server/account-key ownership remains authoritative. See ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md for implementation and pending hosted authorization tests.

## November 2 — Latest technical preparation update

EAS configuration, square icon, startup recovery and client password reset are now implemented. SDK validation passes; dependency high entries are reduced from 19 to 7 after documented triage. Native sessions remain Keychain-backed with device-only availability after first unlock for background tasks. Unused native permissions were removed after source review. See [beta preparation/setup and verification](BETA_PREPARATION_UPDATE.md), [dependency triage](DEPENDENCY_TRIAGE.md) and [current status](RELEASE_READINESS_SUMMARY.md). Earlier audit text remains a baseline/historical snapshot. Hosted Supabase settings, real account/email flows, native builds, signing, device tests and release authorization gates remain open. No production action occurred.
