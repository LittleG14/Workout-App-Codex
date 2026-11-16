# Available Equipment deployment and iPhone checks

## Deployment order and approval gates

1. Reconcile this branch with the developer's current Replit/TestFlight source. Fetched GitHub `main` was `055bc04`, still carrying `com.forge.app`, while the successful beta was built in Replit with `app.replit.swolehouse`. The pre-existing local identity correction is preserved; this feature does not introduce a new bundle ID. Do not overwrite Replit-only authentication, environment or signing changes. Preserve the working beta/build and review the diff before merging. Local work is uncommitted and has not been pushed.
2. Run TypeScript, lint, tests, Expo diagnostics and exports in the reconciled checkout. Confirm the existing Expo project and public environment settings. No new environment variables or secrets are required.
3. **Database migration: none. RLS changes: none.** The preference resides in `auth.users.raw_user_meta_data.available_equipment_v1`, accessed through Supabase Auth's authenticated user API. Do not grant mobile database access to `auth.users`, run `db:push`, or change production profile rows. An ordinary user's Save writes only their preference field; unrelated metadata is merged by Auth. The app never uses a service-role key for this feature.
4. With explicit deployment approval, deploy the Express change first: custom exercise creation now normalizes known equipment aliases and rejects unsupported identifiers. The preferences feature itself talks directly to the existing Supabase Auth user endpoint. Old clients already use the canonical options and remain compatible. Restart/redeployment does not require database changes.
5. Verify reads and saves with dedicated test accounts on the intended Supabase project, including cross-device persistence. Automated tests used in-memory transports, not production data. This is a required pre-release integration check, not a claim of verified hosted behavior.
6. This checkout has no direct `expo-updates` dependency, `updates.url`, `runtimeVersion` or update channels. Changes are JavaScript/UI only, with no new native dependencies/permissions, but the existing binary cannot be assumed to accept an OTA update. **Obtain authorization for a new iOS build and separately for upload to TestFlight.** Build the reconciled source with `npx eas-cli@latest build --platform ios --profile testflight`; upload the exact validated build only after approval. Preserve `app.replit.swolehouse` and use an increasing build number. Do not automatically create/replace signing credentials.
7. Execute the following device checklist before wider rollout. Public App Store publication remains separately gated.

## iPhone / TestFlight checklist (not executed here)

Use two dedicated accounts A/B and two devices, and note app version/build, iOS version, screen size and each result. Stop Replit's development session and use the published API. Keep historical workouts for comparison.

- [ ] First open with an account that has never saved equipment: Generate retains the full existing pool. Profile > Available Equipment is immediately beneath the account tile, the same width, rounded orange/Rubik styling as PRs and Last. PRs and Last still works.
- [ ] Open the menu: options match custom-exercise creation. Bodyweight and None are visibly always available. An unconfigured account initially displays all external options and explains that saving enables filtering.
- [ ] Toggle multiple chips. Verify each checkmark, accessibility checkbox state and 44-point minimum targets. Test VoiceOver, large text, a small iPhone, scrolling to Save/Cancel, and safe-area spacing.
- [ ] Clear all, select Dumbbells, then Cancel. Reopen: unsaved changes were discarded, not persisted. Repeat with system dismissal where available.
- [ ] Save Dumbbells only. Menu closes only after confirmed save. Reopen and restart the app: Dumbbells stays selected. Sign in on the second device and verify the same preference.
- [ ] Generate across chest/triceps, back/biceps, shoulders/abs, legs, push/pull/full body; strength/hypertrophy; supersets/core; and every duration. Every generated choice must require only Dumbbells and/or Bodyweight/None. Bench presses must require Bench too; no barbell, cable, machine or bench-only movements without the corresponding availability.
- [ ] Test circuit AMRAP/EMOM/RFT/Hyrox at short and long durations. Sparse pools may produce smaller valid workouts. Test More Movements and confirm new additions meet equipment rules and existing manually selected exercises are preserved.
- [ ] Refresh a normal exercise, a core slot, each superset slot and a circuit exercise. Use random Add and convert to a superset: new automatic selections must satisfy the same preferences. Exhaust candidates and verify the helpful no-compatible-exercise alert.
- [ ] Save zero external items: reopen as empty (Bodyweight/None always checked). Generate bodyweight-only workouts; back/biceps and mat-based yoga may give a helpful no-exercises message. Confirm no automatic widening of restrictions.
- [ ] Save Dumbbells + Bench and confirm appropriate bench movements become eligible. Save Mat to exercise yoga paths. Change preferences and generate again without restarting.
- [ ] Create a custom exercise using a canonical option; verify it can be selected automatically only when eligible. Manual exercise selection remains unrestricted. Invalid server identifiers must return 400 without inserting a record.
- [ ] Disable networking before opening the menu: show error/retry, never reset to unconfigured. Restore networking and retry. Disable networking during Save: show error and keep the draft/menu for retry; if the request may have reached Auth, reopen after reconnecting to confirm actual server state. Never show a false success.
- [ ] While offline, attempt Generate, Refresh, Add, superset conversion and circuit expansion: block with an error; do not use stale/unrestricted cached values. Existing workout viewing and manual editing retain existing behavior.
- [ ] Sign out A, sign in B: no A selections appear or influence B. Make B's selection different, switch back to A, and verify both. Repeat a slow load/save across logout/login; stale callbacks must not populate the next account's cache or change its workout.
- [ ] Expire/revoke a test session, then load/save/generate: show a recoverable error/sign-in guidance. Do not claim success. Test simultaneous saves: local duplicate requests are rejected; separate devices use normal last-write-wins metadata semantics.
- [ ] Compare historical workouts and custom exercise records before/after changing preferences: no automatic rewrites or deletions. Check PRs/Last, run tracking, navigation, persistence and the prior beta's core workflows.

## Metadata decisions / limitations

- Canonical categories are unchanged and now live in `shared/equipment.ts`, re-exported by `lib/exercises.ts`. Bodyweight/None are implicit capabilities; other categories, including Mat, are external items.
- The existing model has one equipment string. Known aliases (Dumbbell, plural bands, Ropes) normalize to existing options. Explicit `+` or `&` strings mean simultaneous requirements (all must be available); the current custom form still stores one canonical category. No array/OR/optional-equipment schema was introduced.
- Slash strings have no documented machine-readable alternative semantics. They are conservatively excluded for configured accounts: `mob6` Dowel / Band, `mob7` Kettlebell / Plate, `mob8` Bodyweight / PVC, `mob9` Foam Roller / Bench, `mob11` and `mob12` Kettlebell / Bodyweight. A future curated metadata change can safely make specific alternatives explicit.
- Other unsupported labels excluded for configured accounts: `c22` Deadball; `r3/r4` Track; `r5` Hill; `cm6` Pool; `mob21` Wall; `c20` Rope. `cm2` generic cycling/spin Bike is not silently treated as Assault Bike. `c8` Assault Bike and `cm7` Assault Bike Intervals are mapped to the existing Assault Bike category from their explicit names/IDs.
- Legacy omissions: bench-dependent movements add Bench requirements during eligibility (`e1/e2/e3/e5/e12/e15/e33/e34/e55/e61/e67/e68`); pull-ups/chin-ups/hanging leg raises add Pull-Up Bar (`e19/e27/e43`). Chest/tricep dips (`e7/e11`) and preacher curls (`e31`) need apparatus not safely represented by the vocabulary and are excluded for configured accounts. Display tags and saved history remain unchanged. Equipment categories describe the model; this does not certify all real-world apparatus or technique requirements.
- Unconfigured users retain previous behavior, including ambiguous metadata. Once configured, even Select all does not authorize unknown metadata. The menu explains the transition from unconfigured to filtering.
- Generation requires a successful fresh preference fetch even if a cached value exists, so a configured account cannot silently become unrestricted offline. This deliberately requires connectivity for automatic selection; saved workouts/manual selection retain their previous behavior.
- Account ownership is provided by the authenticated Supabase `/auth/v1/user` endpoint and a captured access token, not client-supplied user IDs or RLS on a new table. User metadata is appropriate for a non-security preference; never use it for authorization or privileges.
- Concurrent writes from different devices use Supabase metadata's last-write-wins behavior. No cross-device compare-and-swap or offline save queue was added.
- Live Supabase save/reload, physical-device UI/accessibility, the exact newer Replit beta source, native build and TestFlight delivery remain unverified.

## Rollback

Keep the last known-good beta available. With deployment approval, revert the feature source commits and rebuild/reselect the old beta as appropriate. Existing clients ignore the new metadata field; it can remain in place. No destructive data rollback, SQL migration, credential rotation or historical workout cleanup is required.

## Official references

- [Supabase user metadata](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase authenticated user updates](https://supabase.com/docs/reference/javascript/auth-updateuser)
- [Expo Update prerequisites](https://docs.expo.dev/eas-update/introduction/)
