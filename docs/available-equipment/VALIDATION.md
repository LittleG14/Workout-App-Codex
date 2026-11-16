# Validation — November 16, 2026

Environment: local Windows/PowerShell, Node/npm already installed, Expo SDK 54 dependency tree. Branch `codex/available-equipment`; fetched base `origin/main` at `055bc04`, plus preserved prior uncommitted iOS identity correction. No application dependencies or lockfile were changed.

| Check | Command | Observed result |
|---|---|---|
| Full automated suite | `npm test` | **74 passed, 0 failed** (61 existing + 13 new equipment tests). Final source rerun completed successfully. |
| TypeScript | `npm run typecheck` | **Pass**, exit 0 on final source. |
| ESLint | `npm run lint -- --no-cache` | **0 errors, 21 warnings** in existing application code; new equipment files introduce no lint warnings. No source-rule suppressions added. |
| Expo Doctor | `npx --yes expo-doctor@1.21.5` with `CI=1` / telemetry disabled | **18/18 passed**. Diagnostic tooling only; no app packages installed/upgraded. |
| Expo versions | `npx expo install --check` with `CI=1` / telemetry disabled | **Dependencies are up to date**, exit 0. |
| Express compilation | `npm run server:build` | **Pass**, esbuild output about 32.8 kB. Server not started against production. |
| iOS JS/Hermes and web export | `node node_modules/expo/bin/cli export --platform ios --platform web --output-dir .verification/equipment-export` | **Pass**, final source export completed. iOS Hermes `entry-d0a60283877b3b309658cc8bfb172c06.hbc`: 5,617,765 bytes. Web `entry-6bedffeee5bca9e85bc2c6ef8b6acfc8.js`: 3,561,232 bytes. |
| Whitespace/errors | `git diff --check` | **Pass**. Git emits expected Windows LF/CRLF notices. |

Export environment used dummy public values only: `EXPO_PUBLIC_DOMAIN=api.example.invalid`, `EXPO_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_validation_placeholder`, `CI=1`, `EXPO_NO_TELEMETRY=1`. These are not service configuration for release. Generated output is ignored by Git and EAS upload. An export is not a signed native build or device test.

The first sandboxed Expo diagnostics failed because network access/cache was unavailable. The initial local export failed when Metro could not spawn workers (EPERM). Their explicitly permitted reruns succeeded. These execution-environment failures were not fixed by changing dependencies or weakening application checks.

## Added automated coverage

`tests/equipment.test.ts` contains 13 focused tests covering:

- All simultaneous equipment requirements, bodyweight/None, empty selection, missing/unknown metadata and aliases (including prototype-property names rejected as unknown).
- Unconfigured compatibility and conservative handling of incomplete apparatus / ambiguous slash strings.
- Dumbbell-only integration across weight splits, core/supersets, circuit formats, running/mixed cardio, mobility and durations; no unavailable hill instructions on fallback intervals.
- Mat-only yoga, helpful empty-pool failures and valid smaller bodyweight workouts.
- Normal/core replacement, random additions, superset-partner selection primitives, hidden IDs and eligible circuit expansion without rewriting original workouts.
- Custom exercises with multiple simultaneous requirements and preserved equipment metadata.
- Initial remote unconfigured state, one/multiple/empty saved selections, editing, recreated repository/device-like reload, logout/relogin and account isolation.
- Failed fetch/save, foreign users, malformed/unconfirmed responses, direct and wrapped Auth user response shapes, concurrent saves and stale load protection.

Repository tests inject in-memory authenticated-account transports. They do **not** prove the behavior of the deployed Supabase instance, its Auth configuration, or mobile network stack. Chip interaction, Cancel/dismiss behavior through the rendered UI, failed-save draft retention, screen layout, VoiceOver and cross-device live saves remain manual checks in `DEPLOYMENT_AND_TESTING.md`.

## Outstanding gates

- Reconcile the newer Replit/TestFlight source that has not been pushed to the observed GitHub branch; do not replace that checkout blindly.
- Confirm real hosted Auth saves/reloads and account isolation using dedicated test users, with authorization for those test writes.
- Approve the Express deployment and separately any new iOS build/upload. Run the documented device checklist on the exact resulting build.
- No SQL migration, new RLS policy, new environment variable, permission, or native dependency is required. No production resources, signing credentials, EAS build or upload were changed here.
