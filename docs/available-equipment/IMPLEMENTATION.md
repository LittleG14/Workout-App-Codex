# Available Equipment implementation

## Architecture and plan (recorded before implementation)

- Profile: `app/(tabs)/profile.tsx`, primary `account-card` near the top; orange rounded `prButton` / Rubik text. Insert the new full-width control immediately after that card. Existing custom creation chips are in `app/workout/[id].tsx`.
- Equipment: `lib/exercises.ts` exports `EQUIPMENT_OPTIONS`; built-in and custom exercises have one `equipment: string`, not an array of alternatives. Several built-ins use aliases, ambiguous slash-separated values, or omit necessary apparatus. Keep the display/history metadata intact; conservatively resolve eligibility separately.
- Automatic selectors: `generateWorkout` and its category generators, `pickRandomNewExercise`, normal/core replacement, and circuit rebalance. Workout detail also automatically chooses a superset partner. Manual picker stays unrestricted.
- Persistence: `lib/profile-storage.ts` is account-scoped local storage, not cross-device profile storage. `AuthContext` already uses Supabase user metadata for name/avatar. Use `user_metadata.available_equipment_v1` for this non-security preference, preserving unrelated keys. Supabase Auth's authenticated user endpoint provides ownership; no extra table, RLS policy, service credential, or SQL migration is needed.
- State: reuse TanStack Query with account-keyed cache and existing account-generation assertions. Fetch current remote preferences before every automatic selection; failures block the operation. Saves use the captured account token, verify the returned user and saved value, and do not optimistically close the editor. Concurrent local saves are rejected. Missing metadata means unrestricted; explicit saved empty means bodyweight-only.
- Work on `codex/available-equipment`, based on fetched `origin/main` (`055bc04`), preserving the pre-existing local iOS identity correction. GitHub does not yet contain the developer's newer Replit build/environment changes; final reconciliation with that source is required before deployment.

## Planned validation

Pure eligibility and all generator variants; isolated account persistence with injected transport, failed fetch/save, stale work/account switching and concurrent saves; TypeScript, lint, existing tests, Expo diagnostics/version check, and local JavaScript exports. No production API writes, migrations, native builds or submissions.
