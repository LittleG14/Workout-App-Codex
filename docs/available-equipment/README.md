# Available Equipment — implementation summary

Implemented locally on `codex/available-equipment`. No deployment, production data changes, SQL migrations, native builds, TestFlight submissions, credential changes or application dependency installations/upgrades were performed. The pre-existing iOS identity correction remains `app.replit.swolehouse`.

## Architecture and behavior

The Profile screen's account card is followed immediately by an Available Equipment button reusing the PRs/Last button styles. Its full-screen modal and custom exercise creation share the same canonical equipment chips. Draft selections are copied when opening, discarded on Cancel, and retained on a failed save. Save closes only after the authenticated backend confirms the correct user's exact normalized preference. Bodyweight/None are always available.

Supabase user metadata already stores account details; `available_equipment_v1` adds a non-security account preference without changing the local measurement profile or introducing a table. Account-keyed TanStack Query caches and generation scopes prevent cross-account reuse. Every automatic choice fetches the current preference; load errors do not authorize unrestricted generation. An absent field retains previous unrestricted behavior; configured empty means bodyweight only.

All category generators, ordinary/core refresh, superset refresh/partner selection, circuit refresh, random additions and circuit expansion share one eligibility boundary before selection. Simultaneous requirements use all-items matching, aliases normalize consistently, and unknown/ambiguous metadata is excluded for configured users. Existing muscle/split/style/duration/hidden-exercise rules remain in effect. Existing sparse-pool behavior returns smaller valid workouts or an explanatory error. When an unavailable hill exercise falls back to a running interval, its instructions no longer require an uphill location. Manual picking and existing historical records are not filtered or rewritten.

## New files

| File | Purpose |
|---|---|
| `shared/equipment.ts` | Existing canonical vocabulary, aliases and preference validation |
| `lib/equipment-eligibility.ts` | Reusable all-requirements eligibility and conservative legacy apparatus handling |
| `lib/equipment-repository.ts` | Confirmed persistence, owner checks and stale/concurrent operation protection |
| `lib/equipment-service.ts` | Authenticated Supabase user GET/PUT with captured account token and timeout |
| `lib/useEquipmentPreferences.ts` | Shared account-keyed query state and fresh-load/save methods |
| `components/EquipmentOptions.tsx` | Shared accessible equipment chips |
| `components/AvailableEquipment.tsx` | Profile control and draft selection modal |
| `tests/equipment.test.ts` | Eligibility, generation integration and account-persistence tests |
| `docs/available-equipment/*` | Plan, implementation summary, validation and deployment/device checklist |

## Modified feature files

- `app/(tabs)/profile.tsx`: insert control beneath account card without changing PRs/Last.
- `app/(tabs)/index.tsx`: load current remote preferences before generating/saving.
- `app/workout/[id].tsx`: guard every automatic selector, explain exhausted pools, share custom chips and validate equipment.
- `lib/exercises.ts`: re-export shared vocabulary; combine equipment exclusions with existing hidden IDs at every automatic entry point; preserve historical/manual entries during rebalance.
- `server/routes.ts`: normalize/validate equipment for new custom exercises; preserve existing records.

The existing working-tree edits to `app.json`, `scripts/validate-release-config.cjs`, `tests/startup-config.test.ts` and `docs/release-readiness/IOS_IDENTITY_UPDATE.md` predate this feature and correct the confirmed iOS identity. They were preserved rather than reverted to the stale identifier on GitHub.

## Delivery status

Implementation and isolated automated validation are complete. Final deployment readiness is conditional on reconciling the newer Replit beta source and completing hosted Supabase/device checks. The available GitHub snapshot is not proven identical to the binary currently in TestFlight. No remote resources were changed.

- Database migration/RLS changes: **not required**.
- New environment variables/services/native permissions/dependencies: **none**.
- Express deployment: **required for stricter custom-equipment API validation**, after approval.
- Existing EAS Update delivery: **not configured in this checkout**, so do not assume OTA delivery.
- iOS/TestFlight: **new authorized build and separate upload required** for delivery on the observed configuration. No native API changes were introduced by this feature.
- Live cross-device persistence, actual iPhone UI/accessibility, cancellation/draft behavior through the rendered modal, expired-session behavior and native runtime: **manual validation pending**, not claimed as passed.

See [the original architecture plan](IMPLEMENTATION.md), [deployment order, metadata inventory and device checklist](DEPLOYMENT_AND_TESTING.md), and [validation results](VALIDATION.md).
