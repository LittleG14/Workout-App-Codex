# Swole House release readiness summary

Updated November 2, 2026. **Overall status: NOT READY.** The requested beta-preparation technical changes are implemented locally. Known release/security blockers, real service configuration and native/device validation remain.

Working checkout: C:\Users\geare\Documents\ChatGPT\Swole House Code Review\remediation, branch codex/ios-release-readiness. The original supplied repository remains unchanged (69 baseline hashes verified). Changes are local, uncommitted and unpushed.

## Implemented

- Account-owned persistence/cache/query isolation and explicit workout owner metadata; unowned legacy records remain unassigned without import.
- Durable per-account offline create/edit/delete queues, stale-response rejection, safer SecureStore session generations and account transitions.
- Generator pool validation, superset ordering and normalized personal-record comparisons.
- Persistent background run/walk drafts, native location task/configuration, timestamp timing, pause/finish/sign-out handling, recovery and fixed-ID save retries.
- EAS preview/simulator/TestFlight/production profiles, public environment preflight, optional real project UUID/owner configuration, retained com.forge.app identifier and SDK 54/Xcode 26 image selection.
- Square opaque full-bleed icon; explicit removal of unused permission declarations; native configuration introspection.
- Recoverable startup timeout/retry, safe missing-config handling, PKCE auth callbacks and complete client password-reset screens/flow; device-only Keychain availability after first unlock for background ownership checks.
- Compatible dependency security patches and documented triage of every prior high entry; no forced framework/ORM/schema transition.

See [beta preparation and hosted setup](BETA_PREPARATION_UPDATE.md), [account/background-run implementation](ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md), [dependency triage](DEPENDENCY_TRIAGE.md), and [earlier remediation progress](REMEDIATION_PROGRESS.md).

## Current verification

| Check | Result |
|---|---|
| Regression suite | **61 passed / 0 failed** |
| TypeScript | Pass |
| ESLint | **0 errors / 23 warnings**; generated verification exports excluded |
| Expo Doctor 1.21.5 | **18/18 passed** |
| Expo SDK dependency check | Pass; 38 SDK-managed direct packages match their installed SDK ranges |
| Native config introspection | Pass; com.forge.app, opaque square icon, intended location descriptions/background mode, unused permissions absent |
| iOS JavaScript / web-CSS export | Pass; placeholder public environment; not native release binaries |
| Server compilation / expo-asset patch | Pass; server not started; patch applies to 12.0.14 |
| Actual release environment preflight | Expected failure: real API/Supabase public configuration and linked EAS project ID are not supplied |
| Native build / signing / device tests | Not performed |
| Remote CI / TestFlight / App Review | Not run / not uploaded / not submitted |

Online audit: **61 affected package entries: 0 critical, 7 high, 52 moderate, 2 low**. Prior working scan had 19 high. Unique advisory URLs fell from 52 to 16, with no new URL in the final scan; affected-package counts and unique advisories measure different things. All remaining findings are retained in evidence/beta-npm-audit.json. The seven high entries are not waived; CI's existing high-audit gate is expected to fail. Original zero-advisory evidence was previously superseded and must not be treated as current.

## Remaining blockers and manual steps

1. Supply the intended preview/production public service configuration and real Expo project UUID; confirm Expo ownership, Apple account access and ownership of com.forge.app. No project/app/signing credentials were created or modified.
2. Inspect/configure the Supabase redirect allowlist, email templates, SMTP/quotas and password policy. Test actual signup/reset/email-change links on disposable accounts and an installed device. The client is implemented, but delivery/hosted redirects are unverified.
3. Complete account-associated deletion/retention and hosted authorization/Data API/RLS/grants verification against the actual schema (R002/R011). No production database changes occurred.
4. Resolve or formally disposition the remaining decoder/ORM/image-parser/Zod high findings and continue moderate/low triage; preserve SDK compatibility.
5. Finish cross-device conflict rules, API payload/rate limits (including large run uploads), full auth/persistence failure QA, privacy/support policies/disclosures, archive privacy manifests, accessibility and measured performance/battery testing.
6. Commit reviewed source and obtain separate native-build/signing authorization, then separate upload approval. Inspect the actual archive, run the device matrix, process TestFlight and only later obtain separate App Store submission approval.

No Apple signing, native/EAS build, upload, production deployment, database migration, hosted auth change, actual password reset, TestFlight upload or App Store submission was performed. Static success does not certify that the app will launch or track correctly on an iPhone; that remains the next native/device validation stage.
