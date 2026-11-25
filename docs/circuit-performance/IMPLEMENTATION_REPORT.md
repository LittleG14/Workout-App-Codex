# Circuit timing and performance implementation

Implemented November 25, 2026, on `codex/circuit-performance` in `C:\Users\geare\Documents\ChatGPT\Swole House Code Review\remediation`. The clean starting commit was `17e9c9c`, containing the previous Just Run audio/route work. No pre-existing uncommitted work was present.

HYROX station timing, comparable timed PRs/Last, EMOM progression and manual AMRAP counters are implemented. Automated validation passes. **Native build validation and physical iPhone acceptance remain required.** No native build, upload, deployment, production data change, migration or signing operation was performed. Changes are local and uncommitted at delivery.

## A Architecture findings

| Area | Existing implementation and integration |
| --- | --- |
| Generation | `lib/exercises.ts`, `generateCircuit` and `rebalanceCircuit`. Generation prescriptions, randomness, equipment filtering and balance calculations are unchanged. |
| Shared display | `app/workout/[id].tsx`, `CircuitBlockCard`, displays the continuous circuit list for all four formats. Only HYROX/EMOM/AMRAP select the new tracked list. Rounds for Time retains the original renderer and stopwatch. |
| HYROX | Format `Hyrox`, subtype `hyrox`. The generator alternates `hx_run` 1 km runs with stations. Repeated exercise IDs are intentional; block/exercise occurrence position identifies each separate timer. |
| EMOM | Format `EMOM`. Blocks define an exercise list, full rounds and a time cap. Long workouts can contain two independent blocks. Each minute cycles the exercise list, then the next prescribed block begins without added transition time. |
| AMRAP | Format `AMRAP`. Long workouts can contain two blocks; each gets its own manual round count. |
| Rounds for Time | Format `Rounds for Time`, subtype `rounds_for_time`. No tracking marker, new controller, new row controls, automatic progression or changed stopwatch behavior applies. |
| Previous circuit timer | Screen-local `swState`, `swElapsedRef` and a one-second incrementing interval. Five-second countdown, tap pause/resume and hold to save total time. It had no durable active-session recovery or station records. These functions remain intact for Rounds for Time. The three requested formats now use the same start/countdown/pause/finish workflow with a durable timestamp controller. |
| Audio | `lib/run-audio.ts` and the local `SwoleRunAudio` Expo module. Existing bundled ding, AVAudioSession ducking and cleanup are reused. A shared ownership guard prevents one workout feature from canceling another feature's audio. |
| Persistence | `lib/workout-repository.ts` serializes account-owned AsyncStorage mutations, queues offline changes, and synchronizes authenticated workout JSON to Express. `shared/schema.ts` stores workout data as JSON text. Optional circuit metadata fits the existing schema. |
| History | Generated workouts are saved before they are performed; History opens the same detail route. A new marker distinguishes new trackable prescriptions from older records whose measurements were never recorded. |
| PRs and Last | `lib/personal-records.ts`, `computePRs`, calculates from owned workout history. Existing strength calculations remain unchanged. Timed workload variants extend the same exercise entry and the same Profile modal; there is no separate PR database. Existing hidden-exercise/reset timestamps apply. |
| Stack | Expo 54.0.38 installed, React Native 0.81.5, React 19.1.0, Expo Router, New Architecture, local Expo modules and generated native projects. No framework upgrade or replacement. |

## B Implementation summary

### Shared state and clock

`lib/circuit-session.ts` implements pure transitions with an injectable clock. `lib/circuit-controller.ts` owns one serialized circuit controller per account. `components/CircuitRuntime.tsx` supplies one foreground display pulse independent of detail-screen navigation. There are no per-exercise JavaScript intervals.

The new `circuitTrackingVersion: 1` marker is added at the generation-screen save boundary only for supported new circuits. It does not alter the generator or mark older history entries. The optional `circuitSession` contains the captured prescription, numeric millisecond durations, independent occurrence IDs, block round counts, one active HYROX pointer, clock anchors, completion confirmations, finite EMOM sequence and durable chime cursor. Existing `durationMinutes` remains the prescription; `elapsedSeconds` still stores actual completed workout time.

Native `circuitClockMs` uses `mach_continuous_time`, relative to this module's initialization, so sleep can be included without depending on device wall-clock changes. The installed React Native timing primitive uses `std::chrono::steady_clock`; it was not assumed to include iOS device sleep. Apple distinguishes continuous time from clocks that stop during sleep. [Apple continuous clock documentation](https://developer.apple.com/documentation/kernel/1646199-mach_continuous_time)

Device-time fallback is available in older binaries/web/Android runtimes, but is visibly marked and excluded from timed PRs. Running sessions recovered after process restart are paused for review, retain reconstructed timing and remain excluded from timed PRs for that attempt. Implausible or negative clock changes pause at the last saved point. Normally paused sessions retain their exact accumulated time without adding the pause duration. Wall-clock changes within a native-clock session do not change elapsed durations or the relative ordering timestamp used at completion.

The native module exposes elapsed time since its own initialization, **not raw device uptime**. `PrivacyInfo.xcprivacy` declares system-clock reasons `35F9.1` for elapsed timers and `8FFB.1` for in-app event timestamps. Timer durations and event timestamps follow the existing account-owned workout sync; no device fingerprinting, new analytics recipient or remote clock service is introduced. The native archive must still be checked for manifest inclusion. [Apple required-reason declarations](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)

### HYROX stations and completion

Every station/run row has a timer beside its title, with tabular numerals. Normal timer typography matches the existing Station note: Rubik regular, 11 pt, muted text. Running rows use the existing circuit accent, bolder text and subtle background emphasis. The continuous list remains intact.

Tapping starts/stops the selected occurrence; changing rows freezes the prior occurrence and starts the next at one coordinated timestamp. Repeated starts accumulate. Separate running segments share exercise identity for comparison but have separate occurrence IDs and measurements. Global pause preserves the active pointer and excludes paused time; resume restarts only that pointer. Finishing freezes the active station automatically. Untimed transitions remain part of overall time and do not get allocated artificially to stations.

**Stopping or switching a station does not confirm completion.** A positive stopped station has a lightweight Confirm complete control with an explicit prescribed-work confirmation. A paused active station can also be confirmed; doing so ends its pending resume. Retiming a confirmed station removes its confirmation. Finish saves unconfirmed/partial times in History without awarding timed PRs. Cancel saves an explicitly canceled attempt and excludes it from timed records. Completed/canceled attempts are read-only; generate a new workout for another attempt.

Prescription/load changes are locked once a tracked session starts, including reorder/balance/replacement controls. Existing load logging remains available before starting. A stale full-record save cannot erase newer session metadata. Unfinished tracked workouts cannot be deleted until finished/canceled.

### Timed PRs and Last

Time records extend `ExercisePR.timedPerformances`. Each variant groups exercise identity, exact prescribed quantity, sets, normalized load, equipment and non-generic workload notes. Distances normalize to meters; weights normalize to kilograms via grams for stable comparison. Workload labels remain readable in original units.

Only an explicitly confirmed positive HYROX occurrence in a completed workout qualifies. Zero-display times, incomplete stations, canceled workouts, invalid metadata, EMOM intervals and uncertain recovered/device-clock timing cannot set timed PRs. Best is the fastest eligible time; Last is the most recent confirmed performance within that workload group, including the last confirmed repeated occurrence within one workout. Duplicate sync results do not create extra records.

Missing workload data is retained in History and Last with an explanation, while PR is unavailable. In particular, current generated sled/carry/loaded stations need a logged load before starting. Current generated Ski Erg/Rowing prescriptions can be plain `50` without a distance; these are not treated as 1,000 m performances and do not get a distance-based PR. Generation was deliberately preserved. There is no new prescription editor in this task.

Profile keeps its existing exercise list and PR detail interface. Timed variants show HYROX time, fastest PR and Last separately from any existing weight records. The detail area scrolls to accommodate multiple workloads. Existing strength, Just Run, hide and reset calculations remain in place.

### EMOM progression and chimes

Each occurrence is a separate 60-second record, with block/exercise/round/sequence indexes. Active interval and within-minute time are projected from total active elapsed time, rather than counting timer callbacks. Global pauses are excluded. A render stall or background gap reconstructs the correct sequence; missed foreground chimes are consumed together rather than replayed in a burst. At completion there is no nonexistent next interval, and early finish preserves a partial final interval.

**Schedule rule:** use the configured full-round sequence bounded by its time cap. For example, the existing generator's 30-minute cap with four movements and seven rounds produces 28 scheduled minutes. The UI states the actual scheduled minute count. Two blocks chain their finite schedules; no extra transition/rest interval is invented. The current generator has no separate between-block rest configuration.

Foreground chimes reuse the original local ding and the same native ducking/deactivation path as Just Run. A durable cursor is saved before requesting sound. Audio errors do not delay the logical interval or discard its data. Failed automatic final saves keep the running anchor for retry; the UI distinguishes pending finalization from a saved result.

Optional locked-screen chimes use finite iOS local notifications through the same local module, **not background JavaScript, GPS updates, silent audio or a second AVAudioSession manager**. Permission is requested only from Enable locked-screen chimes. Reopening cancels pending alerts and catches up silently; pause/finish/cancel/sign-out cancel the feature's pending requests. No unrelated notifications are canceled. [Apple local notification scheduling](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app)

The notification system uses the same short PCM ding, also copied into the main bundle where iOS custom alert sounds are resolved. [Apple notification sound resources](https://developer.apple.com/documentation/usernotifications/unnotificationsound)

### AMRAP and History

Each AMRAP block has minus/plus controls followed by its round count at the bottom of the circuit card. Mutations serialize against the latest workout, so rapid taps are not stale-state increments. Counts clamp at zero, survive pause/background/restart/offline sync and stay separate between blocks. Time never increments rounds automatically.

History/detail shows HYROX times in original occurrence order, EMOM recorded intervals by round/sequence including partials, and read-only AMRAP completed counts. Untimed historical measurements show unavailable indicators, not invented zeros. A canceled attempt is clearly labeled. Existing prescribed duration, exercise list, total actual elapsed time and unrelated metadata are retained.

### Files created

| Files | Purpose |
| --- | --- |
| `lib/circuit-session.ts` | Clock projection, transitions, occurrence schedule, validation and display helpers. |
| `lib/circuit-controller.ts`, `lib/circuit-runtime.ts` | Account-bound serialization, persistence/audio/notification coordination and native clock adapter. |
| `lib/circuit-performance.ts` | Comparable workloads and confirmed timed PR/Last collection. |
| `lib/audio-ownership.ts` | Shared native playback ownership across circuit/run features. |
| `components/CircuitRuntime.tsx` | One foreground pulse and app-state integration. |
| `components/CircuitTracking.tsx` | Tracked continuous list, footer controls, confirmations, counters and history presentation. |
| `components/TimedPerformanceRecords.tsx` | Timed workload variants inside the existing Profile detail view. |
| `modules/swole-run-audio/ios/CircuitNotifications.swift` | Finite local notification requests with cancellation/generation guards. |
| `modules/swole-run-audio/ios/PrivacyInfo.xcprivacy` | Clock API privacy declaration. |
| `tests/circuit-session.test.ts`, `tests/circuit-controller.test.ts` | 23 state/performance tests and 15 controller/store/audio tests. |
| `docs/circuit-performance/IMPLEMENTATION_REPORT.md`, `IOS_TEST_CHECKLIST.md` | Completion/deployment instructions and physical-device acceptance. |

### Files modified

| Files | Change |
| --- | --- |
| `app/(tabs)/index.tsx` | Mark newly generated supported circuits on save. |
| `app/workout/[id].tsx` | Select tracked components, recover newly synced attempts, protect recorded prescriptions and retain the legacy Rounds for Time path. |
| `app/(tabs)/profile.tsx` | Timed badge/cards and scrollable PR detail alongside existing weight records. |
| `app/(tabs)/history.tsx` | Prevent deleting an unfinished tracked circuit before its controls can finalize/cancel it. |
| `app/_layout.tsx`, `contexts/AuthContext.tsx` | Mount the account runtime; pause/cancel circuit operations during normal sign-out/account deletion. |
| `lib/exercises.ts` | Optional backward-compatible session/marker types only. |
| `lib/personal-records.ts` | Attach timed variants to existing circuit exercise entries. |
| `lib/workout-repository.ts`, `lib/workout-storage.ts` | Atomic edits using the existing ownership/revision/offline queue; protect newer timing from stale saves. |
| `lib/run-audio.ts` | Reuse native audio through shared ownership; optional continuous-clock/notification methods. |
| `modules/swole-run-audio/package.json`, `ios/SwoleRunAudio.podspec`, `ios/SwoleRunAudioModule.swift` | Local module version 1.1.0, continuous clock, notification methods, system framework and resource packaging. |

No npm packages, lockfile changes, schema migrations, Express changes, access-policy changes or new environment variables are required.

## C Validation results

| Check | Result |
| --- | --- |
| `npm test` | **129 passed, 0 failed, 0 skipped**: original 91 plus 38 new tests. |
| `npm run typecheck` | Passed. |
| `npm run lint -- --no-cache` | Exit 0; 0 errors and the same 21 existing warnings. |
| Targeted ESLint on new components/services/tests | Passed without warnings at the targeted check. |
| `npx expo install --check` | Passed: dependencies up to date. |
| `npx --yes expo-doctor@1.21.5` | 18/18 passed; final module/resource recheck also recorded during completion. |
| iOS and web JavaScript export | Passed with placeholder public configuration; ignored output `.verification/circuit-export`. iOS Hermes bundle approximately 5.75 MB; web JavaScript approximately 3.63 MB. |
| Apple autolinking | Resolves `SwoleRunAudioModule`/`SwoleRunAudio` local pod, version 1.1.0. |
| Expo config introspection | Bundle ID `app.replit.swolehouse`, existing audio/location background modes, no microphone description. No added background mode. |
| Privacy manifest parsing | Valid property list; expected system-clock reasons and no module tracking declaration. Native archive inclusion remains a build check. |
| Rounds for Time source comparison | Original stopwatch implementation and legacy circuit-card render body match pre-feature commit `17e9c9c`. Functional format-gating regression tests also pass. |
| `git diff --check` | Passed during review. |
| Swift compilation, native archive/signing, physical device | Not executed. Windows has no Xcode/iOS device environment. |

The first test run found a floating-point precision assumption in a test assertion; that assertion now uses a sub-millisecond tolerance. TypeScript caught a readonly-array test-fixture mismatch, which was corrected. Export initially failed because the restricted environment could not spawn Metro workers; rerunning with the required process access passed. These were not resolved by upgrading dependencies.

The new tests cover independent/cumulative station timing, rapid/out-of-order taps, coordinated switching, highlighting state, confirmation and completion, global pause/resume, clock changes/recovery, 60-second boundaries, finite repeated/multiple-block schedules, partial intervals, suppressed replay, finite notification offsets, audio failures/ownership, AMRAP rapid concurrent persistence, read-only legacy data, comparable distance/load normalization, faster/slower PR examples, missing/invalid/canceled attempts, hidden/reset stats, idempotent offline/API round trips, account changes during awaits, protected deletes/stale writes and failed-final-save recovery. The existing generator/equipment/auth/session/Just Run/Trace Route/history/strength tests remain passing.

### Known limitations and acceptance gates

- Physical iPhone timing, sleep/clock behavior, UI/VoiceOver, native compilation, chime routing, media restoration and notification delivery are unverified. Mocked tests do not establish these results.
- Local notifications follow iOS notification permission, sound volume, silent mode, Focus and system delivery decisions. Their sound/media behavior differs from foreground AVAudioSession ducking and cannot be guaranteed to bypass those settings.
- Up to 60 upcoming minute alerts are scheduled, with capacity reserved for other pending app notifications. Longer workouts require reopening the app to refresh that finite window. Timing/history still reconstruct all scheduled intervals. No endlessly repeating alert is left running.
- Force-quitting does not communicate a pause/cancel action. Already scheduled finite alerts can remain until their due times or next launch; pause/finish/cancel normally before leaving if alerts should stop. Reopening cancels pending feature alerts before recovery. An alert already delivered exactly at a pause boundary may finish its short sound.
- Interrupted running attempts are restored paused with a timing warning and cannot earn timed PRs for that attempt. They retain History/Last data after explicit completion. Negative or implausible clock gaps preserve the last saved point. An undetectable wall-clock change while the process is absent cannot be certified as accurate elapsed time.
- Loads/distances that the existing prescription does not specify cannot support a defensible comparable PR. The UI explains this before starting where possible. Generation remains unchanged.
- Existing sync is not a distributed live-workout lock across multiple devices. Use one device per active attempt; server storage/policies were not changed. Older beta clients can read existing JSON but should not edit these tracked attempts using their older stopwatch UI.
- There is no mounted native component/E2E test framework in the repository. Automated coverage tests state, presentation helpers, persistence and mocked audio/API interactions; native gestures/layout/audio remain manual acceptance.

## D Deployment requirements and sequence

| Requirement | Needed |
| --- | --- |
| Supabase migration or access-policy update | No. |
| Express deployment or production database modification | No. Existing authenticated workout JSON routes are reused. |
| npm dependency installation | No new package. Run `npm ci` after checking out the reviewed commit to reproduce the existing lockfile. |
| New Expo project/environment variables | No. Use the current linked project and existing preview environment. |
| iOS configuration/capabilities | No new background mode, APNs entitlement, microphone or location permission. Local notification alert/sound authorization is optional and requested in app for locked-screen EMOM chimes. The local module adds the UserNotifications framework, clock bridge, privacy manifest and bundled alert sound. |
| New iOS native binary | **Yes**, to include module 1.1.0 and its native methods/resources. A JavaScript OTA cannot add them. This repository also has no configured expo-updates delivery mechanism. |
| TestFlight upload | Required after an authorized successful build, before device acceptance. |

### Save and transfer reviewed source

These are owner instructions, not commands already executed. Review the changes before committing. On the laptop in PowerShell:

```powershell
Set-Location 'C:\Users\geare\Documents\ChatGPT\Swole House Code Review\remediation'
git status
git branch --show-current
git diff
git tag beta-before-circuit-timers 17e9c9c
git add app components contexts lib modules tests docs/circuit-performance
git diff --cached --stat
git commit -m "Add circuit station timing, EMOM progression and AMRAP tracking"
git push origin beta-before-circuit-timers
git push -u origin codex/circuit-performance
git log -1 --oneline
git status
```

If the backup tag already exists, inspect it rather than replacing it. The previous beta branch/commit remains available. This feature branch does not automatically replace main.

In Replit Shell, first confirm the working tree is clean. Preserve any Replit-specific changes or resolve conflicts before switching; do not discard them blindly.

```bash
cd ~/workspace
git status
git fetch origin
git switch codex/circuit-performance
git pull --ff-only origin codex/circuit-performance
git log -1 --oneline
npm ci
npm run typecheck
npm run lint -- --no-cache
npm test
npx --yes expo-doctor@1.21.5
npx expo install --check
npx eas-cli@latest whoami
npx eas-cli@latest project:info
git status
```

If Git cannot create the local tracking branch automatically, use `git switch --track origin/codex/circuit-performance` once. The commit IDs on laptop/Replit must match. If Expo login is needed in Replit, use `npx eas-cli@latest login --no-browser` to avoid the remote localhost callback issue.

The existing testflight build profile loads the preview environment and remotely increments the build number. Confirm the existing EAS project ID, API hostname and Supabase public values are still set. Keep `app.replit.swolehouse`. No Replit backend republish is required for these feature changes.

### Authorized native build

**Checkpoint: obtain the owner's explicit authorization to generate the iOS build.** From the clean reviewed checkout:

```bash
npx eas-cli@latest build --platform ios --profile testflight
```

Reuse existing credentials. Creating/replacing Apple signing credentials requires separate authorization. Check the build log for pod version 1.1.0, Swift compilation, main-bundle `run-ding.wav`, resource-bundle privacy manifest and unchanged bundle identifier. This environment did not perform native compilation, so treat its first successful build as a required verification result, not an assumption.

### Authorized TestFlight upload

**Checkpoint: obtain separate authorization to upload the successful build.** Replace `BUILD_ID` with that exact build's UUID:

```bash
npx eas-cli@latest submit --platform ios --profile testflight --id BUILD_ID
```

After Apple processing, assign the new build to the intended TestFlight group and install that build number on the iPhone. An Expo build link alone does not place the binary in TestFlight. Public App Store review/release is a later, separately authorized action. [Expo iOS submission](https://docs.expo.dev/submit/ios/)

Complete [the iPhone checklist](IOS_TEST_CHECKLIST.md), including clock changes, sleep, media restoration, optional notification denial and the Rounds for Time regression. Keep the prior TestFlight build available until this feature passes acceptance.

### Rollback

Keep tag `beta-before-circuit-timers` and the previous working TestFlight build. For shared source history, review and `git revert FEATURE_COMMIT_SHA` instead of force-resetting branches. A rollback binary needs its own authorized higher-numbered build/upload. New fields are optional JSON metadata; do not delete workout rows or run schema changes to roll back. Preserve the recorded data for later inspection.

## E Physical iPhone acceptance

Use [IOS_TEST_CHECKLIST.md](IOS_TEST_CHECKLIST.md) to record device/iOS/build/commit, results and failures. Native clock correctness, chime/media cleanup and locked-screen notification behavior are release acceptance gates, not results inferred from unit tests or a successful JavaScript export.
