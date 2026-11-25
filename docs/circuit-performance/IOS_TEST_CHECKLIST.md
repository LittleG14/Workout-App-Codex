# Circuit timers physical iPhone checklist

All checks below are pending. Use the new authorized native development/TestFlight binary containing SwoleRunAudio 1.1.0. Record iPhone model, iOS version, build number, commit, permission state, audio route/media app and pass/fail evidence. The previous binary and Expo Go do not contain the new continuous clock/notification methods.

## Install and setup

- [ ] Upgrade over the working beta without deleting its data. Existing account, equipment preferences, workout history and PRs remain available.
- [ ] Confirm `app.replit.swolehouse` and the intended new build number. Verify startup, authentication/session restore and logout still work.
- [ ] Generate one new HYROX, EMOM, AMRAP and Rounds for Time workout. No exercise, equipment filtering, prescribed reps/distances, balance or generation behavior should unexpectedly change.
- [ ] Review each new workout before starting. No timing begins until pressing the existing workout start control and completing its five-second countdown.
- [ ] Open older HYROX/EMOM/AMRAP history with no new fields. Measurements are unavailable, not invented zero records. Existing total time/information remains visible and no recorded timers can be restarted in place.
- [ ] Use a small and large iPhone, larger text and VoiceOver. Titles/timers must not overlap. Row names, timer actions, confirmations and plus/minus controls must have meaningful labels and usable touch targets. Profile variants and workout lists must scroll.

## HYROX timing

- [ ] Each new exercise/run occurrence initially shows 00:00 at the title's right, using station-note typography and tabular numerals. Long titles wrap without hiding the timer.
- [ ] Tap a station after global start. Only that row becomes highlighted and starts timing.
- [ ] Tap it again. It stops and retains the elapsed value; active emphasis clears.
- [ ] Start it again. It accumulates from the prior value rather than resetting.
- [ ] Tap another station while one runs. The first freezes and the second starts immediately using a single transition. Only one row remains highlighted.
- [ ] Rapidly tap/switch rows and choose them out of order. No overlapping timers, lost cumulative time or duplicate occurrence identity.
- [ ] Time two repeated 1 km runs independently. Their separate values survive subsequent switches and do not overwrite one another.
- [ ] Pause the workout while a station is active. Overall/station times freeze; active highlight is suspended. Wait, resume and verify paused time is excluded from both.
- [ ] Manually stop a station, then globally pause/resume. The stopped station must stay stopped.
- [ ] Confirm a stopped station's full prescribed work using Confirm complete. Retiming it removes completion confirmation. Confirming the currently paused station should end its pending resume; resuming the workout must not restart it.
- [ ] Finish while a station runs. Its time is finalized, but it must not become a completed/PR-eligible station automatically. Untimed/skipped stations remain distinguishable.
- [ ] Include rest/untimed transitions. Station totals can be less than overall time; no artificial balancing occurs.
- [ ] Exercise the hours-format case where practical in a development test. Times above 59:59 must show hours rather than wrap to zero.

## HYROX PRs and Last

- [ ] Log any prescribed external load before starting. The UI warns where a load/exact workload is insufficient for a comparable PR. Once started, prescription/load/reorder/balance edits cannot change the performance definition.
- [ ] Finish a comparable, explicitly confirmed attempt. In Profile → PRs & Last → Circuit → exercise, see its workload, timed PR and Last, separate from any existing weight record.
- [ ] Repeat with a faster confirmed time. PR and Last both update to that attempt.
- [ ] Repeat with a slower confirmed time. PR retains the faster value; Last shows the slower latest completion.
- [ ] Complete repeated identical running occurrences in one workout. PR selects the fastest; Last reflects the last confirmed occurrence, not necessarily the fastest or last row position.
- [ ] Different prescribed distances/loads must remain separate. Equivalent km/meter and kg/lb workloads must normalize correctly when representative test data is available.
- [ ] Missing loads, ambiguous prescriptions and generated Ski Erg/Rowing counts without a distance retain History/Last with an explanation and no misleading distance PR.
- [ ] Zero-display, unstarted, unconfirmed, partial, canceled and invalid attempts do not create timed PRs. EMOM intervals never create HYROX timed PRs.
- [ ] Hide/reset an exercise through existing Profile controls. Timed and existing weight data follow the existing visibility/reset rules while history remains intact.
- [ ] Existing weightlifting PR/Last values and Just Run PRs remain unchanged.

## EMOM progression

- [ ] Confirm the displayed finite schedule against prescribed rounds and time cap. A four-movement, three-round workout has 12 intervals. A generated 30-minute cap/four movements/seven rounds has 28 scheduled minutes.
- [ ] After countdown, first exercise activates at 00:00. Before 60 active seconds it remains current; at completion its interval records 01:00, chimes, then the next starts with no transition gap.
- [ ] Follow more than one full round. Repeated row timers show the current occurrence, while recorded intervals retain every previous round independently.
- [ ] Test one-exercise and multiple-block workouts. The sequence wraps only for prescribed rounds and chains the next block correctly.
- [ ] Tap exercise rows while active. It must not skip/reset the sequence or start a HYROX-style timer.
- [ ] Pause at a partial minute, such as 00:35, wait two minutes, resume and verify another 25 active seconds completes it. Repeat immediately before a boundary; no chime occurs during the pause.
- [ ] Temporarily stall rendering/switch screens. On return the correct minute/row is selected without accumulating timer drift or replaying a burst of missed chimes.
- [ ] Finish early. The current partial interval and completed prior intervals remain saved in order; future intervals are not fabricated as completed.
- [ ] Complete the prescribed final minute. It plays its completion chime, freezes total time, records the final interval and starts no extra exercise. Watch for any storage error/pending finalization and use Retry saving if needed.
- [ ] Reopen recorded intervals in History. Round/interval/exercise identity, partial labels and actual durations remain available and read-only. Interval completion is not represented as proof of completed exercise repetitions.

## Audio and locked screen

- [ ] Foreground ding with no other media: audible, short and pleasant, using the current output. No network connection is needed.
- [ ] Play music, then a podcast, before starting an EMOM. Foreground chimes temporarily duck other media where supported and restore its perceived level afterward. Check for at least 30 seconds after playback/cancellation.
- [ ] Repeat using Bluetooth headphones; connect/disconnect them around a boundary. No permanent media attenuation, overlapping burst or stuck audio session.
- [ ] Interrupt a foreground chime with Siri/a call. Later intervals recover; progression and history remain correct even if that chime fails.
- [ ] Pause, finish, cancel or sign out around a chime. No later app-owned playback remains queued, and other audio is restored. Account switching must not surface another account's workout details.
- [ ] Before an EMOM, explicitly enable optional locked-screen chimes and allow alert/sound permission. No microphone, extra location request or APNs registration should be needed.
- [ ] Deny notification permission or disable notification sounds. The app explains foreground-only chimes; timers, counters and history still function. Do not treat a missing locked-screen sound as a successful delivery test.
- [ ] With notifications allowed, lock/pocket the phone across several minute boundaries. Check audible finite alerts, then reopen: correct interval/timing and no replay of missed foreground chimes.
- [ ] Repeat locked with music, podcasts and Bluetooth. Record how system notification sounds affect the media; their routing/ducking follows iOS policy rather than the foreground audio-session manager.
- [ ] Repeat with silent mode and Focus enabled/disabled. Document permitted/suppressed alerts; these are ordinary notifications, not critical alerts that bypass system settings.
- [ ] For a workout exceeding 60 minutes, verify the stated finite alert window and reopening to refresh it. No indefinitely repeating alert should continue after the prescribed schedule.
- [ ] Pause/finish/cancel with future alerts scheduled, then lock the phone again. Later pending feature alerts must be canceled. An alert already delivered precisely at the boundary may finish its short sound.
- [ ] Test with location permission denied: circuit timing/chimes do not use Just Run GPS to keep JavaScript alive.

## Sleep, recovery and data

- [ ] Leave the phone locked long enough to enter normal sleep. Compare HYROX overall/station and EMOM interval timing to an independent clock after reopening. No sleep time should disappear with the new continuous-clock binary.
- [ ] If device policy permits, change device date/time during an offline test and restore automatic time afterward. In-process native elapsed timers should remain stable; completion ordering should not jump with the wall clock.
- [ ] Navigate away/back while a station/EMOM is active. Timers/progression remain owned by the account runtime, not restarted by screen mounts.
- [ ] Terminate/relaunch during an active attempt. It restores paused for review with a timing warning, keeps measurements/counters, does not replay old chimes, and excludes that recovered timing from PRs. Abnormal/negative/very long clock gaps preserve the last saved point.
- [ ] Distinguish force-quit from Finish/Cancel: finite system notifications can remain scheduled after a force-quit until due or next launch. Confirm normal Finish/Cancel cancels them and no alert extends past its finite schedule.
- [ ] Pause normally, restart, resume and verify the paused duration is excluded. Manually stopped/confirmed stations must remain stopped.
- [ ] Save offline, restart, reopen History, reconnect and synchronize repeatedly. One workout identity remains, with no duplicate PR/performance records. All optional measurements survive.
- [ ] Attempt a failed save/storage interruption in a suitable development environment. No false saved count/complete state or discarded measurements; final interval save remains retryable.
- [ ] Sign out/account-switch with an unfinished attempt. Normal sign-out pauses it; the other account cannot see/control its data. Sign back in and recover it.

## AMRAP counters

- [ ] New block starts at zero. Minus at zero is disabled/ignored; never negative.
- [ ] Plus increments exactly once. Rapid presses are not lost; minus corrects an accidental increment.
- [ ] Multiple AMRAP blocks have independent counts and one counter each, not one per exercise.
- [ ] Pause/resume, navigate away/back, background and restart. Counts remain unchanged except for explicit button presses.
- [ ] Finish with zero rounds and with positive rounds. Both are saved as actual new measurements; prescribed/actual duration is not replaced by count.
- [ ] History shows the final block count without active plus/minus controls. Older history without a count shows unavailable.

## Regression and acceptance

- [ ] Rounds for Time generation, continuous list, balance controls, stopwatch, pause/hold-to-stop/save and history look and behave as before. It gets no new counters, station highlight or EMOM progression.
- [ ] Weightlifting generation, exercise edits, supersets, weights, strength PRs/Last and history remain functional.
- [ ] Equipment availability filtering, custom exercises and hidden exercises behave as before.
- [ ] Just Run GPS, pause/resume, distance/pace/history, Sound/Update ducking, locked tracking and Trace Route remain functional. Circuit cleanup must not cancel an unrelated run announcement.
- [ ] Existing account recovery, session persistence, offline queue and historical workouts remain available.
- [ ] Record unresolved failures before increasing beta distribution. Native compilation, accurate sleep-inclusive timing, media cleanup, finite notification cancellation and format regressions are required acceptance checks; a successful build alone is insufficient.
