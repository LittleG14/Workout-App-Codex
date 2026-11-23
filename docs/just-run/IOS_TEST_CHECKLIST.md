# Just Run physical iPhone verification

All items below are pending. Run on the new native development/TestFlight binary, not Expo Go or the previous beta. Use a safe outdoor route and record iPhone model, iOS version, app version/build, commit, permission state, audio output, media app/version, results and any recording/log evidence. Do not count mocked automated tests as native playback results.

## Install and baseline

- [ ] Verify the installed build matches the authorized EAS build/commit and existing `app.replit.swolehouse` app. Existing account, history and equipment settings survive the upgrade.
- [ ] Launch online and offline; authenticate/recover the existing session, navigate tabs, generate/start/complete a normal non-run workout and reopen its history. Confirm startup/recovery screens remain usable.
- [ ] Use a smaller iPhone (including SE dimensions if supported) and a larger iPhone. Increase text size and use VoiceOver. Verify setup scrolls and Cancel, Save, Clear, location, pause/resume and stop remain visible/reachable with at least comfortable touch targets.
- [ ] Deny location access: Trace Route can still navigate/draw using fallback. Starting GPS tracking explains the failure without creating a false active run. Grant foreground-only access: the run warns it is app-open only and pauses on background. Grant background/Always and Precise Location for the locked-screen cases.
- [ ] Leave microphone access unrequested. No new push-notification or speech-recognition permission should appear.

## Audio interval matrix

Complete **all eight** interval/type combinations, observing at least two milestones each. Record the ribbon and actual spoken metrics from the same workout. Average pace is active time divided by actual distance; paused time is excluded.

| Unit | Interval | Sound | Update |
| --- | --- | --- | --- |
| Miles | 0.5 mi | [ ] | [ ] |
| Miles | 1 mi | [ ] | [ ] |
| Kilometers | 0.5 km | [ ] | [ ] |
| Kilometers | 1 km | [ ] | [ ] |

- [ ] Sound is one short pleasant ding through the selected output, with no network sound download.
- [ ] Update says actual total distance, total active time and **average** pace per selected mile/kilometer. Compare to the live metrics allowing for time taken to speak. No Infinity/NaN, excessive decimals or invalid pace.
- [ ] Never disables both ribbon milestones and audio. Switching Sound/Update before starting is obvious and only one type is selected. Last-started settings are preselected for the next run under that account.
- [ ] Rerenders, navigating away/back, temporary backgrounding and resuming do not replay old milestones. Paused movement adds no tracked distance/announcements; the next threshold after resume continues from accumulated distance.
- [ ] Delayed/batched GPS crossing multiple thresholds yields one current announcement rather than overlapping old announcements. Stationary GPS drift/poor accuracy/implausible jumps do not cause an announcement burst. Record GPS behavior in an outdoor walk as well as a run.

## Media and native cleanup matrix

Check both Sound and Update wherever applicable. Start other media **before** starting the run.

- [ ] With no music, confirm speaker playback at a sensible media volume. Repeat in silent mode; session playback should be audible while media volume is above zero.
- [ ] With Apple Music or another music app, hear temporary attenuation during ding and speech. Confirm perceived media volume returns immediately after completion and remains normal for at least 30 seconds.
- [ ] Repeat with at least one podcast/spoken-audio app. Record whether iOS ducks or the media app pauses; confirm normal playback/restoration afterward without restarting the run. Any permanent pause or reduced volume fails acceptance and requires native investigation.
- [ ] Use Bluetooth headphones from run start. Repeat Sound and Update while backgrounded/locked. Verify output stays on the current route, including another compatible output if available.
- [ ] Connect headphones during a run. Disconnect while a notification is playing, then reconnect. The interrupted notification stops and does not immediately repeat; later milestones recover on the current output. Check other media is not left ducked.
- [ ] Receive a call and invoke Siri during speech. Notification cancels; after interruption, later milestones recover. The app does not seize the call/Siri audio route or leave media attenuated.
- [ ] Pause during a ding and during speech. Playback/pending announcements stop promptly, music restores, no further audio while paused. Resume and cross the next milestone.
- [ ] End the workout during speech. Audio stops, music restores, summary remains usable and no delayed notification plays after end. Repeat while a later update is queued.
- [ ] Sign out/account-switch after pausing a run. No prior-account notification plays, and settings/drafts are not visible under the other account.
- [ ] Run with airplane mode/offline media after map tiles are loaded. Ding and installed-voice speech do not require a network request. If no English voice is available, the live error is recoverable and actual GPS recording remains intact.
- [ ] Observe volume for at least 30 seconds after each interruption/failure and after leaving Just Run. Persistent ducking or an unhandled native error is a release blocker.

## Background and screen lock

- [ ] With Always/background location and Precise Location enabled, start a run, lock the screen and pocket the phone. Cross at least two milestones without reopening the app; verify Sound and Update in separate runs.
- [ ] Repeat locked while listening to music, then a podcast, using Bluetooth headphones. Compare stored GPS distance/active time to the route actually traveled.
- [ ] Switch to another app for multiple milestones; return and confirm correct ribbon schedule, persisted cursor, actual path and planned overlay without duplicate old audio.
- [ ] Background during an active announcement and foreground afterward; verify the announcement completes/cancels cleanly and media restores.
- [ ] Exercise Low Power Mode/temporary poor GPS or connectivity and record delivery delays. Background delivery timing is controlled by iOS and may batch; it must not create bursts or alter route distance with planned metadata.
- [ ] Test an interrupted/terminated app recovery separately. Force-quit is not a supported way to continue GPS/audio; on reopening, recover the run with its planned route, authoritative recorded data and appropriate interrupted/paused state. Old milestones must not replay. Do not claim continuous tracking after force-quit.

## Route planning and gestures

- [ ] Select Just Run. Trace Route occupies the previous Set Up Run position; Set Up Run sits immediately below, with matching width, height, rounding, typography and alignment. Other workout generation buttons retain their behavior.
- [ ] Open Trace Route. Current location is used when available. Denied/unavailable location uses a navigable fallback without blocking Save. Retry location after a timeout without losing the drawing.
- [ ] In Navigate, pan with one finger and two fingers together; pinch/spread to zoom. In Draw, dragging draws without moving the map. Switch modes repeatedly without losing coordinates.
- [ ] Draw a route with several turns. Miles and kilometers update smoothly to two decimals; compare a known geographic path's approximate length. Values must sum the whole drawn path rather than start-to-end distance.
- [ ] Pan/zoom in Navigate, return to Draw and continue from the endpoint. The saved geographic line stays on the same roads/paths; no silent road-snapping occurs. Starting too far away gives useful guidance rather than a large false segment.
- [ ] Try a tap/very short line, duplicate points, excessive zoom-out and a very long dense trace. Invalid/too-short/point-limit errors preserve the current drawing without crashing; draw at a useful zoom to continue within the documented bounds.
- [ ] Use Add map center with VoiceOver as an alternate point control. Check labels, focus order, font scaling, contrast and top distance text on narrow displays.
- [ ] Clear a substantial route and cancel confirmation: keep it. Confirm Clear: only the editor line/distance reset; the map stays usable and drawing can restart immediately. Delayed native coordinate conversion must not resurrect the old line.
- [ ] Save a valid route: close only after successful persistence. Return to Trace Route and verify restored shape/distance. If storage fails, remain in the editor with an error and no false success.
- [ ] Edit a saved route, Clear/redraw, then Cancel: original saved route remains. Save an edit: replacement appears next time. Explicit Remove saved route requires confirmation; subsequent runs have no plan.
- [ ] Background the editor, reopen it and recover an unsaved drawing. Restart the app after allowing the backup to persist and accept/discard recovery; saved route must remain unchanged until Save. Record the expected debounce window for immediate termination.
- [ ] Disconnect networking or simulate unavailable map tiles. Coordinates and drawing are preserved; offline guidance/Reload map permit recovery. No success claim should imply tiles loaded when they have not.

## Setup and live map integration

- [ ] Save a plan, return to Just Run, open Set Up Run, choose each unit/type, start. No extra route-selection step; correct planned route appears on the existing map.
- [ ] Initial fit shows the entire plan where practical and includes the last fix when available. Current user position remains available; recenter/follow works, pan stops follow, later metric updates do not force the camera back while exploring.
- [ ] Cyan dashed planned route remains fixed geographically. Orange actual GPS segments extend as the runner moves. Zoom/pan preserve alignment and the user-location indicator remains functional.
- [ ] Deviate from the plan: actual GPS continues, planned geometry remains unchanged and no reroute/off-route speech is generated. Planned distance never changes live actual distance/pace/time.
- [ ] Run the full example: saved plan + 0.5-mile Update + music + Bluetooth + locked phone, then foreground to inspect both paths and stop/save.
- [ ] Start a run without a plan: existing GPS, ribbon/audio, pause/resume and recording work. Finish a planned run, then start an unrelated run: old plan is not silently attached again.
- [ ] Start a different workout while a next-run plan exists, return to Just Run and confirm appropriate saved planning state. Account-switch and verify account isolation.

## Completion and regression

- [ ] Pause/resume after substantial travel; no connecting distance across paused movement. Stop freezes elapsed time; summary retains authoritative metrics.
- [ ] Save completion offline, restart, reopen history, then synchronize online. Actual path, planned path, unit and notification selection survive; only one workout identity is saved. Historical workouts without these optional fields still open.
- [ ] Save a planned run with no recorded movement; planned overlay may appear in summary/history, but actual distance remains zero and pace remains unavailable.
- [ ] Reopen history, share existing workout details where applicable, delete a test workout and check session persistence. No change to normal generated workouts or earlier running history.
- [ ] Record battery use, app responsiveness and memory behavior during a longer run with both features. Investigate regressions before expanding the beta.

## Acceptance record

Record pass/fail per item plus unresolved issues. Native compilation, audio ducking/restoration, background delivery, Bluetooth routing and map gestures must pass on physical hardware before declaring this feature beta-ready. A successful EAS build alone is insufficient. Build/upload/App Store release each retain the owner's explicit authorization gate.
