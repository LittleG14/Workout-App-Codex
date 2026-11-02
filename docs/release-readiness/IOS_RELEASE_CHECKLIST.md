# iOS release checklist

Current status: **NOT READY**. First implementation batch is locally verified; see [remediation progress](REMEDIATION_PROGRESS.md). Release/device checkboxes remain open until their evidence exists. Date: October 30, 2026. Boxes are deliberately unchecked; this is a plan, not a record of passed checks. No Apple credentials were created or changed, and no build/upload/submission was performed.

## Approval and identity

- [ ] Approve audit and remediation scope before application changes.
- [ ] Create dedicated `codex/ios-release-readiness` branch/checkout; preserve original baseline.
- [ ] Confirm Apple Developer Program membership, team permissions, current agreements, required business/contact details, and App Store Connect access.
- [ ] Confirm `com.forge.app` belongs to the team and is the intended persistent bundle ID. Do not change an established app ID casually.
- [ ] Confirm Expo account/organization, project owner, EAS project UUID and app record association.
- [ ] Confirm Swole House display name, slug, version 1.0.0 intent and initial/incrementing build number policy.
- [ ] Obtain explicit authorization before creating/modifying signing credentials, certificates, profiles or App Store API keys.

## Application and backend gates

- [ ] Resolve R001 account isolation and safe migration; A/B device-switch tests pass.
- [ ] Resolve R002 associated-data deletion including local state; verify staged failure/retry and backups/email retention policy.
- [ ] Resolve R003 offline queue/deletion behavior and R004 secure session cleanup.
- [ ] Resolve R005 excluded/empty generator pool failures and R018 concurrent/error-prone persistence.
- [ ] Resolve R026 mixed-unit PR comparisons and R027 superset conversion/display-order omissions.
- [ ] Inspect deployed database permissions/RLS/API exposure (R011) without changing production data.
- [ ] Replace/separate destructive migration automation (R010); rehearse only in disposable DB; test restore.
- [ ] Host Express continuously at a stable HTTPS API endpoint, with Supabase/database/Resend connectivity; a static website alone is insufficient.
- [ ] Configure server-only credentials privately; validate mail sender domain, admin allowlist and routing with staging recipients only.
- [ ] Confirm TLS/certificate renewal, environment isolation, log redaction/retention, rate limits, backup and monitoring ownership.
- [ ] Verify startup fails clearly or degrades intentionally when optional mail is absent (R023).
- [ ] Complete auth confirmation/recovery/email-change flows and decide guest-access policy.

## Dependency and EAS configuration

- [ ] Install dependencies in the approved writable checkout after audit approval; preserve and review lockfile changes.
- [ ] Align clipboard/sharing/maps/keyboard-controller with SDK 54 or demonstrate supported native compatibility; preserve sharing/GPS functionality.
- [ ] Review expo-asset patch against the resolved package; do not blindly remove/reapply it after upgrades.
- [ ] Run `npx expo-doctor`, `npx expo install --check`, `npx tsc --noEmit`, `npm run lint`, automated regression tests and `npm audit`.
- [ ] Add eas.json development/preview/production profiles; explicit environment and store distribution; documented version source/build increment.
- [ ] Configure public API/Supabase variables for each build environment; prove no privileged secret, localhost or transient Replit developer host enters app bundles.
- [ ] Validate resolved app config/plugins and all asset paths. app.json currently uses portrait orientation, iPhone-only support and New Architecture.
- [ ] Use a compatible Xcode **26 or later** / iOS **26 or later SDK** build image meeting Apple's upload floor effective April 28, 2026; reconfirm at build/submission time. [Official requirements](https://developer.apple.com/news/upcoming-requirements/).
- [ ] Establish actual minimum iOS deployment target from generated native settings. Do not confuse the deployment target with the SDK used to build. No target override is present in current app.json.
- [ ] Validate maps, keyboard-controller, Reanimated/worklets, view-shot, clipboard/sharing and experimental native tabs on a real New Architecture binary. Use classic-tab fallback on supported older iOS versions.
- [ ] Inspect generated Info.plist, entitlements, linked frameworks, privacy manifests and build warnings. Current absence of native folders is a CNG workflow candidate; never regenerate/remove intentionally maintained native code without review.
- [ ] If OTA is introduced, define compatible runtime versions, channels, staged rollout/rollback and new-binary rules for native changes. Otherwise document that EAS Update is not configured.
- [ ] Inspect build upload inventory for archives, old Git/cache/agent state, attached screenshots and unnecessary generated files. Metro bundle reachability and EAS upload inclusion are different checks.

## Artwork, permissions and privacy

- [ ] Replace nonsquare 350×356 icon with approved square source art; inspect full-bleed treatment and opacity and generated 1024×1024 AppIcon. Verify image/brand ownership.
- [ ] Validate release splash screen and portrait orientation on small and large iPhones. Expo Go does not prove production splash behavior. [Expo asset guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
- [ ] Provide feature-specific foreground location purpose text describing route/distance tracking. Confirm no unjustified Always/background, camera, microphone or photos declarations from auto-plugins.
- [ ] Test location first request, denial, permanent denial/Open Settings, approximate location, unavailable GPS and permission changes during a run.
- [ ] Verify final PrivacyInfo.xcprivacy required-reason declarations and applicable SDK privacy signatures/manifests. Do not invent reasons unrelated to actual API use.
- [ ] Publish accurate policy with real retention/deletion wording and processor/route/feedback disclosures; add easily accessible in-app and signed-out links.
- [ ] Verify public HTTPS privacy/support URLs and responsive contact route without reviewer login.
- [ ] Complete App Privacy answers using [SECURITY_PRIVACY_REVIEW.md](SECURITY_PRIVACY_REVIEW.md); include third-party collection and account-linked fitness/location where applicable.
- [ ] Confirm ATT applicability based on actual tracking practices. No tracking integration was observed; don't assert “no data collected.”
- [ ] Assess export compliance for encryption; confirm any exemption and corresponding Info.plist/App Store answers with owner. Do not automatically set an unreviewed exemption flag.
- [ ] Confirm age rating questionnaire, target audience and fitness claims; no unsupported medical promises.

## Production build — separate authorization required

Only run after code/config remediation and explicit user approval to initiate a production build:

```sh
eas build --platform ios --profile production
```

- [ ] Record approved commit, EAS build ID/URL, profile/environment, Node/npm, Expo/RN, image/Xcode/SDK, version/build number and signing status without private material.
- [ ] Record successful/failed result, full warning disposition, dependency/config/plugin errors and artifact provenance.
- [ ] Validate archive icon, entitlements, deployment target, native permissions/manifests, bundled assets and production host values.
- [ ] Verify production-mode launch, navigation and backend operations; a successful build alone is insufficient.

## TestFlight — separate upload approval required

- [ ] Obtain approval to upload the exact build. Use explicit build ID/artifact selection to prevent uploading an unrelated “latest” build.
- [ ] Configure required App Store Connect app record and review/export fields; do not create credentials without authorization.
- [ ] After upload approval, use a configured submission profile and explicit build selection, for example `eas submit --platform ios --id <validated-build-id>`; consult the installed CLI help before executing.
- [ ] Record upload processing result and TestFlight build number; prepare beta description/contact/test notes.
- [ ] Confirm internal/external tester eligibility and any Beta App Review requirements; do not claim external testing is enabled before processing/review succeeds.
- [ ] Execute the device matrix below against that exact build and intended services.

## Manual device matrix

Record device model, OS, app build, account/test data, tester, result and evidence for every scenario. Minimum matrix: small-screen and large-screen iPhones; minimum supported OS and current iOS; clean install and upgrade; production-like and staging environment as appropriate.

| Area | Required scenarios / expected evidence |
|---|---|
| First launch | Splash/fonts; missing/invalid config graceful failure; signed-out landing; first onboarding/registration state; cold launch offline and valid persisted session. |
| Auth | Signup/confirmation, correct/incorrect login, recovery, email/password update, logout, expired session, failed sign-out and A/B isolation across restart. |
| Navigation | Every tab/detail/admin/run screen, back/swipe, not-found and cold/warm links; non-admin requests denied server-side; native/classic tabs. |
| Generator | All five categories, every subtype/duration/style, core/superset combinations; custom-only/hidden/all-hidden pools; replacements, add/remove/reorder and rebalance. |
| Workout editing | Weight/note logging, stopwatch start/pause/finish, PR/reset/hide; rapid/repeated actions and concurrent persistence. |
| History/sync | Restart, edit/delete/create offline then reconnect, app killed before retry, delayed server responses and two-device conflicts; routes retained only for correct user. |
| Running | Permissions/Settings, GPS failure/low accuracy, countdown cancellation, pause-and-move, lock/background, long run, stop/save/discard, process death and draft recovery. |
| Export | Regular/run share, destination cancellation, copy image, unavailable sharing; no sensitive route accidentally in cards; useful errors. |
| Feedback | Every category/limit, offline/server failure, duplicate taps, correct user history and staged user/admin email delivery. |
| Account deletion | Confirm/cancel, full data cleanup, partial failure/retry, expired token, deletion offline and next-account login. |
| Lifecycle | Memory pressure, terminate/restart, background/foreground, incoming interruption, orientation lock and permission change mid-feature. |
| Layout/accessibility | Keyboard avoiding inputs, modals, safe areas, maximum Dynamic Type, VoiceOver order/names/actions, sufficient targets, contrast, reduced motion. |
| Resource use | Large history/multi-hour run CPU/memory/battery, payload limits; slow network and disk/storage failure recovery. |
| Production differences | Real installed binary with production public values, no developer server, release splash/icon, no dev-only errors, services reachable on cellular. |

## App Store metadata and review

- [ ] Title/subtitle/description/keywords accurately describe shipped features and foreground tracking limits.
- [ ] Real screenshots for required device dimensions, using the validated build; no Expo Go wrapper or unsupported capabilities.
- [ ] Correct icon, support/marketing/privacy URLs, category, copyright, territories/pricing and age questionnaire.
- [ ] Confirm third-party content/font/logo rights and any regional commercial/legal fields.
- [ ] Provide working reviewer credentials and clear instructions for generation, GPS, sharing and deletion; explain permission use and any account-access justification.
- [ ] Keep backend and reviewer accounts functional throughout review; provide test data without private user information.
- [ ] Confirm purchase/social-login/UGC/advertising requirements still match the final feature set; reassess if scope changed.
- [ ] Record completed device results and outstanding risks; resolve all material blockers before claiming submission readiness.
- [ ] Obtain **separate explicit App Review submission authorization** for the exact build/metadata. Uploading to TestFlight is not this approval.
- [ ] Submit only after that authorization. Record submission/review result; publishing/release timing remains separately controlled as requested.

Source reference: [current Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). This checklist is an engineering aid, not a compliance certification.

## Approved background-running release gate

- [ ] Build a new installed native binary with TaskManager and the location plugin; Expo Go or a JavaScript-only update does not validate this feature. Obtain the applicable build authorization first.
- [ ] Verify the actual archive declares only the required `location` background mode, accurate When In Use/Always text, and no unused fetch job.
- [ ] Execute all eight permission, lock-screen, account-switch, recovery, battery, route-quality and accessibility checks in ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md. Record iOS version, device, build ID and results.
- [ ] Update policy/App Privacy answers for account-linked precise location recorded during user-started background workouts. Confirm draft/server/backups retention and account deletion before making deletion claims.
- [ ] Explain user-started run/walk tracking and reviewer steps under Apple 2.5.4 and 5.1.5. Do not promise continuous execution after force quit.

## November 2 — Latest technical preparation update

EAS configuration, square icon, startup recovery and client password reset are now implemented. SDK validation passes; dependency high entries are reduced from 19 to 7 after documented triage. Native sessions remain Keychain-backed with device-only availability after first unlock for background tasks. Unused native permissions were removed after source review. See [beta preparation/setup and verification](BETA_PREPARATION_UPDATE.md), [dependency triage](DEPENDENCY_TRIAGE.md) and [current status](RELEASE_READINESS_SUMMARY.md). Earlier audit text remains a baseline/historical snapshot. Hosted Supabase settings, real account/email flows, native builds, signing, device tests and release authorization gates remain open. No production action occurred.
