# Account ownership and locked/background running

November 1, 2026. Approved product decisions implemented locally on `codex/ios-release-readiness`. Overall release status remains **NOT READY** because the other release blockers remain unresolved.

## Ownership decision

New workouts, runs, custom exercises, feedback and private preferences belong to the authenticated creating account. Private device records and query caches use account-specific keys. The workout generator captures the account before its asynchronous loading delay and rejects a changed account before generating/saving. Newly persisted workouts now carry an explicit `userId`; known account-scoped older records acquire their key's owner when read. Foreign-owner workout objects are rejected on save and excluded from API cache ingestion. The server derives ownership from verified authentication, overwrites client owner metadata and includes both record ID and owner ID in private SQL reads/updates/deletes. Client metadata is not an authorization control.

Earlier **device-wide, unowned** records remain preserved and unassigned. They are neither shown in another account's history nor uploaded or offered for user-claimed import. A user confirmation cannot establish who originally created those records. Any future recovery would need independently reliable ownership evidence and a separate reviewed migration. Shared built-in exercise definitions are application content; existing server-authorized administration of support feedback remains a privileged feature.

Hosted API negative tests, database grants/RLS and account-data deletion still require staging verification (R002/R011). These code changes do not establish that the deployed environment is secure or that account deletion is complete.

## Tracking implementation

- `lib/run-tracking.ts` registers a global TaskManager location task, imported by `app/_layout.tsx`. SDK-compatible `expo-task-manager` 14.0.9 was installed with lifecycle scripts disabled; no major framework upgrade occurred.
- `app.json` enables background location and explicit feature-specific iOS permission descriptions, and Android background-location/foreground-service configuration. A small config plugin removes SDK 54 TaskManager's automatic `fetch` background mode because no fetch job exists. Introspection confirms only `location` is declared on iOS.
- Setup explains the purpose before permission prompts. It requests foreground then background access. If background access is denied/unavailable, the user must explicitly accept app-open tracking; it is labeled on the run screen and native foreground-only runs pause when the app leaves the foreground. Denied location, unavailable Location Services and failed native starts surface errors. Settings remains available for permission recovery.
- `lib/run-repository.ts` persists one private draft per owner with a stable run/workout ID, mode, status, timestamps, distance and GPS segments. Serialized writes coordinate controls and GPS batches. Background tasks resolve the owner against the secure persisted session without mounting AuthContext. No tokens are stored in the run draft/binding. Missing or mismatched authentication stops tracking and never assigns the draft to another account.
- Time derives from elapsed timestamps, not JS timer ticks. Pause excludes paused duration, stops native GPS and breaks the route segment so travel during a pause is excluded. Batches reject old, duplicate, invalid and inaccurate fixes; poor accuracy produces guidance. This is basic GPS quality handling, not a guarantee of measured-distance accuracy.
- Screen unmount does not own native tracking. Signing out or changing accounts pauses the previous owner's run; that draft remains private for recovery when its owner returns. Native errors preserve a paused draft. Failed storage writes still attempt to stop GPS. If no native task remains after interruption, recovery conservatively ends the elapsed segment at its last recorded location.
- Tap **Start Run / Recover** in Just Run setup to return to an unfinished run or its stopped summary after restart. An existing draft cannot silently be replaced. Save uses its stable ID and clears the draft only after durable workout persistence; retrying after a cleanup interruption does not create a second workout. Discard explicitly removes the stopped draft.
- Distance milestones remain **in-app alerts while viewing the run screen**. No lock-screen milestone notification feature was added or claimed.

## Data and privacy change

Precise coordinates and timestamps are now processed while a user-started run/walk continues with the app backgrounded or screen locked. They are stored in the owning account's private local draft (AsyncStorage within the application sandbox). The active binding contains only owner/run identifiers. The draft is retained until save/discard; signing out pauses and preserves it. Saving adds the route to the existing owner-scoped workout/offline queue and synchronizes it to the configured Express/PostgreSQL backend when available. No separate third-party route-upload service or advertising SDK was introduced. Existing map-provider traffic, platform location processing, backend retention and backups still need final disclosure/retention confirmation.

Update the privacy policy and App Store App Privacy answers to reflect background **precise location linked to the account**, used for app functionality, and actual retention/deletion behavior. Do not claim routes are always device-only or removed from every system on account deletion: R002 remains unresolved. Background location itself is not evidence of cross-app advertising tracking/ATT applicability.

## Verification and remaining gates

Automated repository tests, TypeScript, ESLint, Expo dependency validation, native configuration introspection and an iOS JavaScript/Hermes export were executed locally. See [TEST_REPORT.md](TEST_REPORT.md) and `evidence/background-run-verification.json` for final results. The bundle uses placeholder public environment configuration and is not a releasable binary. Express compilation did not start the server or contact the database. The online npm scan remains 47 entries (0 critical, 19 high, 26 moderate, 2 low).

**No native iOS build, iPhone lock-screen test, signing change, device battery measurement, TestFlight upload or submission has occurred.** A new installed native binary is required; a JS-only update or Expo Go cannot establish background-location support. Force quitting, permission revocation and OS policies can interrupt tracking. Continuous recording after force quit is not promised.

Required device checks before closing R013/R014/R016/R017 for this feature:

1. Clean install; allow full/background access; deny foreground/background access; Allow Once; permanent denial; Settings recovery; approximate location; Location Services disabled.
2. Start a run/walk, lock the iPhone for at least 15 minutes, switch apps, unlock and compare recorded route, distance and elapsed time to a measured course. Repeat with weak GPS/tunnel and lost network. Confirm the system location indicator and no idle GPS after pause/finish.
3. Pause, move to a different location, lock/unlock, resume; ensure paused travel and time are excluded, including in summary route segments.
4. Sign out during a run, switch A to B, restart B, sign back into A; B cannot view/save/discard A's draft, GPS stops on sign-out, and A can recover the paused draft. Test expired/refreshed sessions and delayed batches.
5. End without saving; restart and recover summary; fail local save; interrupt between durable save and draft cleanup; retry and verify one history entry with the same ID. Test repeated save/stop taps and countdown cancellation.
6. Force quit/relaunch and OS interruption; verify truthful interruption/recovery behavior without promising background execution after termination. Revoke permission mid-run and recover. Test process restoration against the actual SDK 54 native task lifecycle.
7. Multi-hour run: compare GPS accuracy, memory, storage growth, JS responsiveness, battery drain and server route-upload size limits; inspect logs and outbound traffic for accidental route/token leakage.
8. VoiceOver, large text, small/large iPhones, background-mode permission strings and actual archive privacy manifests. Android foreground notification/permission recovery requires separate device validation if shipping Android.

Production build, TestFlight upload and App Store submission remain separate explicit authorization gates. Existing non-run blockers remain in [RELEASE_READINESS_SUMMARY.md](RELEASE_READINESS_SUMMARY.md).

## Official sources

- [Expo Location documentation](https://docs.expo.dev/versions/latest/sdk/location/): permission sequence, native configuration, background constraints and platform behavior. Current online docs describe a newer SDK; SDK 54 APIs/options were checked against the installed 19.0.8 source and plugin.
- [Expo TaskManager documentation](https://docs.expo.dev/versions/latest/sdk/task-manager/): global task registration and background task architecture; installed 14.0.9 source was used for version compatibility.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): sections 2.5.4 (background services), 5.1.1 (privacy/data handling) and 5.1.5 (location services) remain release review gates.
