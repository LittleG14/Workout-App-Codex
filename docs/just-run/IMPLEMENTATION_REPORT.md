# Just Run audio and trace route implementation

Implemented on `codex/just-run-audio-route`, based on the clean pre-feature commit `2af6193`. Working directory: `C:\Users\geare\Documents\ChatGPT\Swole House Code Review\remediation`. Date: November 22, 2026.

The source implementation and automated checks are complete. A new iOS native build and physical iPhone testing remain required before beta acceptance. No EAS build, TestFlight upload, Apple credential change, backend deployment, or production data modification was performed. Changes are local and uncommitted at delivery.

## Architecture review

| Existing area | Repository evidence and behavior |
| --- | --- |
| Just Run landing | `app/(tabs)/index.tsx`, cardio `just_run` selection; existing gradient `generateButton` opens `/run/setup`. Trace Route now precedes Set Up Run using the same button styles. |
| Run setup | `app/run/setup.tsx`; miles/km, Never, every 0.5 or 1 unit, permissions and five-second countdown. Sound/Update is attached to the run when it starts. |
| Live run and ribbon | `app/run/active.tsx`; reads the persisted run, renders metrics, map, pause/resume/stop and the visual milestone ribbon. Previously, a screen-local counter triggered only the ribbon. |
| GPS | `lib/run-tracking.ts`; existing `expo-location` foreground watcher or module-scope `expo-task-manager` background task, both using the same run repository. |
| Authoritative state | `lib/run-repository.ts`; serialized account-owned AsyncStorage draft, tracking binding, accepted coordinates, accumulated distance, segment boundaries and timestamps. No second tracker or timer was introduced. |
| Distance and pace | Sum of consecutive accepted GPS segments using the existing Haversine formula. The helper moved to `lib/run-geometry.ts` with the same Earth radius and 1609.34 meters/mile conversion. Pace remains active elapsed seconds divided by actual GPS distance. |
| Time | `elapsedRunSeconds` accumulates active segments; paused time is excluded. There is no separate moving-time detector. Spoken “Total time” uses this same existing workout time, rather than wall-clock time including pauses. |
| Background and recovery | Existing native location updates keep supplying GPS batches; foreground-only runs pause when backgrounded. Existing reconciliation pauses interrupted runs using the last reliable location timestamp. Restored drafts retain notification cursor and planned route. |
| Maps | `react-native-maps` 1.20.1, `PROVIDER_DEFAULT` (Apple Maps on iOS). Live actual GPS segments remain orange. Planned route is cyan and dashed during/after a run. Web already uses a map placeholder; Trace Route explicitly explains that planning requires the mobile map. |
| Audio before this change | Haptics only; no installed audio playback or speech module. |
| Completion and history | `app/run/summary.tsx` converts a stopped draft with `runData`, saves the existing workout JSON with the same identity, then discards the draft. `app/workout/[id].tsx` displays saved route metadata. Existing backend JSON storage accepts these optional fields without schema changes. |
| Stack | Expo 54.0.38 installed (`~54.0.37` manifest), React 19.1.0, React Native 0.81.5, New Architecture enabled, Location 19.0.8, TaskManager 14.0.9. Expo Router with generated native projects; no maintained root `ios/` or `android/` project. |

The implementation sequence was to persist milestone scheduling in the existing GPS writer, add one native audio-session owner, add account-scoped planning and geographic geometry, then connect the existing setup, live map and history screens. The Expo SDK, map framework, backend and authentication architecture remain in place.

## Implementation summary

### Audio notifications

Setup retains Never/0.5/1 and adds accessible Sound/Update choices. Unit, interval and type are remembered per account when starting a run. A running draft captures its configuration, so later setup changes do not affect it. Legacy drafts without audio fields continue with their visual notifications.

`lib/run-milestones.ts` computes thresholds from accumulated GPS meters. The repository writes a durable milestone cursor before dispatching audio. Renders, pause/resume and repository recreation do not reset it. A GPS batch crossing several thresholds produces the latest update and consumes earlier thresholds, rather than playing a burst. The audio queue holds one active and at most one latest pending update; pause, stop and account changes cancel both.

Sound uses an original bundled 0.4-second PCM ding (17,684 bytes). Update uses an installed English system voice through `AVSpeechSynthesizer`, speaking actual accumulated distance, existing active elapsed time and average pace in the selected unit. Time is rounded to natural hours/minutes/seconds and distance to two decimal places. Invalid or insufficient pace is omitted. Neither audio path requests network speech or a remote sound asset.

The local Expo module `SwoleRunAudio` owns both playback and speech. It activates `AVAudioSession` with playback/voicePrompt and mixWithOthers/duckOthers only during an announcement, then deactivates with notifyOthersOnDeactivation and restores the prior category configuration. It does not set device volume or another app's saved volume. Apple's documented ducking window follows session activation/deactivation. [Apple duckOthers documentation](https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/duckothers)

Completion, cancellation, failed startup, playback failure, calls/Siri interruptions, media-services resets, route disconnection and bounded timeouts all use the same native cleanup path. Failed deactivation has bounded retries. A disconnected output cancels playback and briefly blocks immediate replay; the module does not force speaker routing. A brief native background task covers an in-flight announcement; no silent audio loop or foreground JavaScript timer keeps the app alive.

The implementation requests ducking for both music and podcasts. It deliberately does not request `interruptSpokenAudioAndMixWithOthers`, which can pause other spoken audio. Exact attenuation, mixing and resumption depend on iOS and the other media app; podcast/call/route changes may pause or interrupt instead. Automatic media restoration is an implemented native lifecycle requirement, **not a verified device result**. Silent mode is handled using the playback category, but device media volume still governs audibility.

An announcement is claimed at most once. If iOS terminates the process after the claim but before playback, that announcement can be missed; it is not replayed later. GPS delivery can also be delayed or batched by iOS. Force-quitting the app is not supported as continuous tracking/audio operation.

### GPS validation

Review found that accurate-looking GPS teleports could add large distances and trigger false milestones. The existing writer now rejects a segment exceeding `max(40 meters, 15 meters/second × time since last accepted fix)`. Existing accuracy, coordinate bounds, timestamp ordering and paused-segment rules remain. Distance and timing formulas are unchanged. Two older test movements were reduced from 111 meters in two seconds to 11 meters in two seconds so they still test ordinary distance accumulation rather than an implausible jump. This conservative guard still needs outdoor validation; it is not a complete GPS smoothing algorithm.

### Trace Route

The new `/run/trace` screen uses the same native map. Navigate mode permits normal pan/pinch gestures; Draw mode disables native camera movement and accepts a single finger. Native `coordinateForPoint` converts touches to geographic coordinates with a bounded wait. An ordered projection queue coalesces pending touches and invalidates late responses after Clear, camera movement, layout changes or exit.

Sampling is limited to about one point per 75 ms, with duplicate/sub-two-meter segments omitted. Valid points update an incremental Haversine distance in both units. Routes are bounded to 2,048 points, at least 20 meters total, no more than 500 km and no segment above 150 meters. At excessive zoom-out or if continuing far from the endpoint, the editor asks the user to zoom in/continue from the line's end. It does not silently road-snap or invent missing geometry. Extremely dense/long traces can hit the explicit point limit and require a less dense drawing.

Location permission is optional for planning. A current location centers the map when available; otherwise the existing San Francisco fallback is used and users can navigate manually. A bounded location request, Reload map control and offline guidance support recovery. Native map-tile failure states and all gesture interactions need device testing. An Add map center control offers an alternative to freehand drawing; full VoiceOver map usability remains a manual check.

Clear affects the editor only. Save validates and persists a new route before closing. Cancel preserves the last saved route. Explicit removal has separate confirmation. Unsaved editor points are backed up after a short debounce and on background transitions, with a recovery prompt on reopening. An immediate process kill before storage completes can still lose the most recent unsaved points; a saved route is durable before success is shown.

### Persistence and live maps

`run-planning-v1` is account-scoped local storage containing settings, an optional saved route and an optional unsaved editor. Starting a run first durably attaches the plan to its existing draft, then consumes the matching planning ID so unrelated future runs do not inherit it. A consumption failure leaves a recoverable paused run. Discard also retries consumption of that ID before deleting the run; a newer, different plan is preserved.

Planned coordinates never enter actual coordinates, distance, pace or elapsed-time calculations. Optional `RunData.plannedRoute` and `notificationType` fields survive recovery, summary and existing workout JSON history storage. Older workouts need no migration. Route locations have the same account protections as existing GPS history: local before run completion, then retained/synchronized with the workout through the existing authenticated API. No new third-party analytics or recipients were added. Account-scoped AsyncStorage is not encrypted; device access has the same local GPS-data implications as the existing run history.

The live map initially fits the plan (including a last GPS fix when available), keeps its location indicator, preserves orange recorded segments, and offers an explicit recenter/follow control. Panning disables follow. It does not continuously force the camera back while the user explores, overwrite the plan on deviations, reroute, issue turn prompts, or substitute planned distance for actual distance. Summary and workout detail include both paths, including a saved plan with no recorded GPS movement.

### Files created

| Files | Purpose |
| --- | --- |
| `app/run/trace.tsx`, `app/run/trace.web.tsx` | Mobile geographic editor and explicit web limitation. |
| `lib/run-geometry.ts`, `lib/route-projection.ts` | Shared geographic math, route validation and ordered native coordinate conversion. |
| `lib/run-planning-repository.ts`, `lib/run-planning.ts` | Account-scoped settings, saved plan and editor recovery. |
| `lib/run-milestones.ts`, `lib/run-audio.ts` | Durable scheduler helpers, speech formatting, cancellation/coalescing queue and optional native bridge. |
| `modules/swole-run-audio/package.json`, `expo-module.config.json` | Local Expo module discovery. |
| `modules/swole-run-audio/ios/SwoleRunAudio.podspec`, `SwoleRunAudioModule.swift`, `Resources/run-ding.wav` | AVFoundation session/playback/speech implementation and resource bundle. |
| `scripts/generate-run-ding.cjs` | Reproducible original sound generation. |
| `tests/run-enhancements.test.ts` | Focused audio, planning, projection, recovery and native-config tests. |
| `docs/just-run/IMPLEMENTATION_REPORT.md`, `IOS_TEST_CHECKLIST.md` | Completion, deployment and physical verification instructions. |

### Files modified

| Files | Purpose |
| --- | --- |
| `app/(tabs)/index.tsx` | Matching Trace Route button above Set Up Run. |
| `app/run/setup.tsx` | Notification Type, account settings, saved plan attachment and scrollable small-screen layout. |
| `app/run/active.tsx` | Persisted milestone ribbon, distinct planned overlay, follow/recenter and three controls sized for narrow displays. |
| `app/run/summary.tsx`, `app/workout/[id].tsx` | Planned overlay and bounding region in completed runs. |
| `lib/exercises.ts` | Backward-compatible optional RunData fields. |
| `lib/run-repository.ts`, `lib/run-tracking.ts` | Serialized milestone claims, audio lifecycle hooks, plan consumption and GPS jump guard. |
| `plugins/with-run-background.js` | Adds background audio while retaining location and removing unused fetch mode. |
| `.gitignore`, `.easignore` | Anchor root native-directory exclusions so local module native source/resources are tracked/uploaded. |
| `tests/run-repository.test.ts` | Realistic movement fixtures for the new teleport guard. |
| `tests/workout-repository.test.ts` | Offline/recreated history and API round-trip preservation of route/audio metadata. |

No npm dependency or lockfile changes. The native module uses existing ExpoModulesCore and iOS AVFoundation/UIKit. Audio is implemented for iOS; Android/web and older binaries retain visual milestones and show the audio availability limitation. Expo audio/speech were evaluated against their SDK 54 native implementations; one small session owner avoids coordinating separate playback and speech session managers. The installed SDK's autolinker resolves `SwoleRunAudio` from `./modules`; this directory is the documented local-module default. [Expo autolinking](https://docs.expo.dev/modules/autolinking/)

## Validation report

Environment: Windows PowerShell, installed repository dependencies. Automated checks do not execute MapKit, AVFoundation or a physical GPS receiver.

| Check | Result |
| --- | --- |
| `npm test` | **91 passed, 0 failed, 0 skipped**. 17 tests added: 16 in run-enhancements and one history round trip. Existing 74 tests remain passing. |
| `npm run typecheck` | Passed. |
| `npm run lint -- --no-cache` | Exit 0; 0 errors, 21 pre-existing warnings. No new warning in the new editor/services. |
| `npx expo install --check` | Passed: dependencies up to date. |
| `npx --yes expo-doctor@1.21.5` | Passed: 18/18 checks. Initially detected overbroad native ignore rules; both ignore files corrected. |
| Expo iOS and web JavaScript exports | Passed using placeholder public values, output `.verification/just-run-export` (ignored). Native Swift compilation is not part of export. |
| `node node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js resolve --platform apple --json` | Local pod `SwoleRunAudio`, module `SwoleRunAudioModule`, version 1.0.0 resolved. |
| `node node_modules/expo/bin/cli config --type introspect --json` | Resolved bundle ID `app.replit.swolehouse`, background modes `audio` + `location`, no microphone usage description. |
| `git diff --check` | Passed; Windows line-ending notices only. |
| Native compilation, signing, TestFlight, physical iPhone | Not executed. No Xcode/Swift/CocoaPods toolchain or connected iPhone is available in this environment. |

The focused tests cover every half/full mile/km threshold; disabled/paused/stopped states; duplicate/backward/multi-threshold updates; persisted cursor restoration; speech/unit/time/pace formatting; type selection; queued playback cancellation and failure recovery; GPS teleport rejection; known-coordinate geodesic distances; invalid, duplicate and excessive route points; stale projection responses after Clear; saved-route preservation through edit/cancel; account separation; storage failures; active/stopped/legacy draft recovery; and workout-history serialization through a mocked API.

Native audio itself, AVAudioSession ducking/restoration, gestures, screen sizes, Bluetooth, silent mode, voice availability, background scheduling and location accuracy are **unverified**. There is no existing mounted-native component/E2E suite; navigation/UI interactions require the accompanying device checklist. API round-trip tests use an in-memory adapter, not production services.

Restricted execution initially blocked network diagnostics and Metro worker spawning; the checks passed after retrying with the required access. No application packages were installed or upgraded to fix those environment failures.

## iOS and deployment requirements

| Requirement | Action |
| --- | --- |
| New native binary | **Required.** The existing TestFlight binary/Expo Go cannot acquire this Swift module or background capability through JavaScript changes. |
| Permissions | No new microphone, speech-recognition or notification prompt. Retain existing foreground/background location permission and Precise Location. Without background permission, tracking and milestones are app-open only. |
| Native configuration | Existing plugin adds `UIBackgroundModes.audio`; location remains. EAS generates native projects and discovers the local pod during the build. Do not commit or regenerate root native projects manually for this workflow. |
| Expo/EAS configuration | Existing `testflight` profile is appropriate: store distribution, preview environment, remote auto-incremented version. No new profile or project ID is needed. |
| Bundle ID | Keep `app.replit.swolehouse`; do not create a replacement App Store Connect app. |
| Environment | No new variables. Existing preview EAS values must still provide valid `EAS_PROJECT_ID`, `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Keep API hostname without `https://` in EXPO_PUBLIC_DOMAIN. |
| Backend/database | No backend deployment or database migration required. Existing workout JSON accepts optional metadata. No production data was accessed or changed. |
| Privacy | Planned paths are location data. Confirm the existing privacy policy/App Privacy account-linked location disclosures cover planned paths retained in workout history; no tracking SDK was added. |

### Save the reviewed version locally and on GitHub

These commands are instructions for the owner, not actions already executed. Review the diff before staging. The pre-feature commit is preserved by Git; keep the last working TestFlight binary available as well.

Run in laptop PowerShell:

```powershell
Set-Location 'C:\Users\geare\Documents\ChatGPT\Swole House Code Review\remediation'
git status
git branch --show-current
git diff
git tag beta-before-just-run-audio-route 2af6193
git add .gitignore .easignore app lib modules plugins scripts/generate-run-ding.cjs tests docs/just-run
git diff --cached --stat
git commit -m "Add Just Run audio milestones and geographic route tracing"
git push origin beta-before-just-run-audio-route
git push -u origin codex/just-run-audio-route
git status
```

If the backup tag already exists, inspect it with `git show beta-before-just-run-audio-route --no-patch`; do not replace it blindly. The feature branch does not replace main automatically.

### Replit source and preflight

Run in the Replit Shell only after the reviewed feature commit has been pushed. Do not discard local changes or guess conflict resolutions. `git status` must be clean before switching/pulling; preserve any Replit-specific changes first.

```bash
cd ~/workspace
git status
git fetch origin
git switch codex/just-run-audio-route
git pull --ff-only origin codex/just-run-audio-route
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

If the branch has not been created locally, Git normally creates the tracking branch from origin. If it cannot, use `git switch --track origin/codex/just-run-audio-route` once. `npm ci` runs the existing patch-package postinstall and uses the unchanged lockfile. Source synchronization is enough; publishing the Replit backend is not part of this feature.

### Build only after explicit build authorization

From that clean Replit checkout (or the same clean laptop checkout):

```bash
npx eas-cli@latest build --platform ios --profile testflight
```

The profile loads the existing preview EAS environment and increments the remote build number. Confirm the existing team/app and credentials; do not create or replace signing credentials without separate authorization. Inspect CocoaPods/autolinking and Swift compilation logs for `SwoleRunAudio`, resource bundling and background modes. This is the first actual native compilation of this feature and may expose issues that cannot be found on Windows.

### Upload only after separate TestFlight authorization

Record the exact successful EAS build ID, then upload that build (replace `BUILD_ID`):

```bash
npx eas-cli@latest submit --platform ios --profile testflight --id BUILD_ID
```

Select the existing Swole House App Store Connect record. After Apple processing, assign the build to the intended TestFlight group and install the new build number on the iPhone. External testers may require Apple's beta review. An EAS build link alone does not install it into TestFlight. EAS Submit transfers the binary; App Store public review/release is a later, separate action. [Expo iOS submission](https://docs.expo.dev/submit/ios/)

Run every applicable item in [the physical iPhone checklist](IOS_TEST_CHECKLIST.md). Approve the beta only after native compilation and the audio restoration/background cases pass. Do not use `--auto-submit` or publish an OTA update for this change.

### Recovery

Keep `beta-before-just-run-audio-route` and the prior TestFlight build. Testers can select an available prior build in TestFlight while a fix is prepared. For a source rollback on a shared branch, review and revert the feature commit with `git revert FEATURE_COMMIT_SHA`; do not force-reset shared history. A rollback binary also needs a new authorized build/upload with a higher build number. Optional metadata remains backward-compatible; do not delete workout data or planning storage to roll back.
