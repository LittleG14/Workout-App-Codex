# Swole House production readiness audit

> November 1 remediation update: implementation is underway in the dedicated checkout. The initial zero-advisory result is superseded by an online baseline result of 61 and a current result of 47 (0 critical). See [remediation progress](REMEDIATION_PROGRESS.md) for tested fixes, limits, and follow-up R028. The original audit below describes the baseline commit.

Audit date: October 30, 2026 (America/Chicago). **Overall status: NOT READY.**

> Latest product-decision implementation: owner-tagged records and background/locked running are implemented locally. See [account and background-run update](ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md) for evidence, privacy changes and unexecuted device gates. Baseline findings below are preserved as audit history.

## Scope and evidence

Primary repository: `C:\Users\geare\Desktop\Jobs\Swole House\codex_review\Workout-App-Codex`.
Baseline commit: `93bd1f356cee4708fafb44850b4c8a4312a390bd` (`Published your App`). The initial working tree was clean. Reports and audit harnesses were written only under the separate review workspace's `docs/release-readiness/`; application code, dependencies, configuration, Git history, and services were not changed.

All source references below are relative to that absolute repository root and use baseline line numbers. The machine-readable [inventory](evidence/repository-inventory.json) records all 69 tracked files, sizes, SHA-256 hashes and text line counts. There are 46 JS/TS/TSX files. The [static analysis](evidence/static-analysis.json) records import edges, dependency versions, environment references and cleanup candidates. Configuration, route conventions, native autolinking, shell entry points and Metro's web alias were considered before assessing unused code. No applicable AGENTS.md was found in the source tree or checked ancestors. `replit.md` was read as project documentation, not assumed accurate.

The audit covers frontend, server, schema, scripts, configuration, documentation, assets and the committed ZIP. It is a source audit with isolated reproductions, not a native binary certification. No device, simulator, installed dependency tree, Apple account, Supabase dashboard, live schema, hosting configuration, signing assets or EAS account was available for validation. Reachable main-repository history was scanned heuristically; embedded ZIP Git objects and binary agent state were not decoded. These limits are material.

## Executive assessment

The app has substantial implemented functionality, including five workout categories, custom exercises, logging, personal records, sharing, GPS running, feedback and account settings. Its current persistence boundary can transfer one user's workouts and precise routes to another account using the same device. Account deletion is incomplete in the repository's implementation. Offline changes can disappear or reappear unexpectedly. These issues take precedence over refactoring.

Ten isolated defect reproductions succeeded. A 380-case sample of the unmodified pure workout generator passed with default pools. The lockfile vulnerability scan reported zero known advisories. Type checking, lint, Expo Doctor and Expo's compatibility diagnostic remain unexecuted because packages are not installed and offline cache lookup failed. Zero advisories does not establish dependency compatibility or application security.

Release preparation is also incomplete: EAS profiles/project linkage/environment mapping are absent; the configured icon is not square; the privacy policy is inaccessible from app UI and contains unfinished retention wording; and native permissions/privacy manifests have not been inspected in a generated artifact. No production build, TestFlight upload or submission was initiated.

## Technology stack and architecture

| Area | Repository evidence and conclusion |
|---|---|
| Framework | `package.json:26-63`, lockfile: Expo declared `~54.0.27`, resolved **54.0.32**; React Native **0.81.5**, React/React DOM **19.1.0**. |
| Language | TypeScript `~5.9.2`, strict configuration, `@/*` and `@shared/*` aliases; `tsconfig.json:1-24` includes both app and server. Some domain data is cast from `any` without runtime validation. |
| Entry/navigation | `expo-router/entry`; `app/_layout.tsx:21-43`; file routes, four tabs, nested auth screens, workout detail, run setup/active/summary, admin, not-found. Liquid Glass uses experimental native tabs where available; classic tabs otherwise. |
| Native workflow | No tracked or present `ios/` or `android/`; both ignored. Managed config/CNG candidate, no evidence of intentionally maintained native projects. New Architecture enabled. Native build capability remains unproven. |
| UI/runtime | Reanimated 4.1, Worklets 0.5.1, gesture handler, keyboard controller, Rubik fonts, Expo blur/glass/haptics/gradients, Apple Maps through react-native-maps. React Compiler experiment enabled. |
| State | React state/context; singleton TanStack Query client. Domain generator in `lib/exercises.ts`; persistence in `lib/workout-storage.ts`; profile and hidden/reset preferences in AsyncStorage. Run transfer uses module memory. |
| Authentication | **Email/password Supabase Auth** is implemented. Native sessions use a custom chunked SecureStore adapter; web uses localStorage. No implemented Google/Apple login or password-recovery flow was found, despite documentation claims. |
| API/server | Express 5; Supabase `getUser(token)` authenticates requests; admin endpoints check configured email allowlists. Drizzle with postgres-js stores workouts, feedback and custom exercises. Storage is database-backed, not the in-memory implementation described in `replit.md`. |
| Hosted services | Supabase Auth/PostgreSQL, Replit Express hosting, Resend transactional email; admin notification mailbox; platform map services; OS share sheet/clipboard. Hosted configuration and retention remain unverified. |
| Package management | npm, one v3 package lock, 67 combined direct manifest entries. Manifest ranges match lockfile root entries. No installed packages. Lock audit metadata counts 1,228 dependency entries, including optional/dev entries. |
| Testing | ESLint configuration exists. No test files, test script, coverage configuration, or CI workflow found. Audit-only harness is supplied separately. |
| Deployment | `.replit` cloudrun deployment builds static Expo Go bundles plus Express. `scripts/build.js:499-549` explicitly builds an Expo Go deployment; this is not an IPA build. `expo-dev-client` and EAS profiles absent; repository evidence supports Expo Go use, not verified development-build use. |
| Updates | No direct expo-updates integration, runtimeVersion, update URL or channels. The custom server's Expo Go manifest serving is not evidence of configured EAS Update for a standalone binary. |

Data flow: app → Supabase Auth for sessions; app → HTTPS Express API with Bearer token → PostgreSQL for workouts/custom exercises/feedback; feedback → Resend → user and administrator mailboxes. Profile biometrics are local in the inspected implementation. GPS coordinates are included in workout JSON and therefore enter both local storage and server synchronization.

## Dependency and native compatibility assessment

The React/React Native pair matches Expo SDK 54's official compatibility map. Two imported native modules are from a different SDK generation: clipboard resolves **55.0.13** and sharing **55.0.18**, whereas the SDK 54 map specifies **~8.0.8** and **~14.0.8**. Maps resolves **1.18.0** against the SDK map's **1.20.1**; keyboard-controller resolves **1.20.6** against **1.18.5**. These are compatibility findings, not a claim that every differing package necessarily fails compilation. See R006.

The expo-asset patch targets exactly 12.0.12, matching this lockfile; it changes development asset URL protocol selection. Updating Expo patches may require revisiting it. React Compiler, experimental native tabs, maps, keyboard-controller, view-shot and sharing need testing in a real native build. No dependency can be certified New Architecture compatible solely from the manifest. Server packages in the same manifest increase install/build surface but are not necessarily included in Metro's app bundle: import reachability determines that.

Do **not** automatically upgrade the Expo major version. Resolve within SDK 54 first and run diagnostics. Official EAS infrastructure lists a supported SDK 54 image with Xcode 26. Apple's current upload floor is Xcode 26/iOS 26 SDK; targeting an older deployment OS is a separate setting. SDK 54 is not by itself a reason to require an upgrade. See [Apple requirements](https://developer.apple.com/news/upcoming-requirements/), [Expo infrastructure](https://docs.expo.dev/build-reference/infrastructure/) and the [SDK 54 compatibility map](https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json).

## Severity-ranked findings

“Blocks submission” below means an engineering release gate, not a prediction of Apple's decision. “Conditional” means hosted settings, generated artifacts or a product decision must establish whether the risk exists in production.

### R001 — CRITICAL — Account boundaries do not isolate persisted or cached data

- **Evidence:** `lib/workout-storage.ts:7,76-82,99-131,157-170`; `contexts/AuthContext.tsx:48-59,89-92`; `lib/auth-storage.ts:24-26`; `lib/profile-storage.ts:3`; `lib/useHiddenExercises.ts:5-6`; `lib/useCustomExercises.ts:8,33-41`; `app/(tabs)/contact.tsx:288-292`; `lib/query-client.ts:133-146`.
- **Problem/impact:** A's workouts remain under a device-global key after logout. B's SIGNED_IN event uploads local-only workouts with B's token, including A's GPS route. Query caches also omit account IDs and are not cleared on logout, so feedback/custom exercises/admin-derived UI can carry across sessions. Server authorization does not prevent a client uploading another local user's JSON as its own.
- **Verification evidence:** Actual storage code with mocked AsyncStorage, tokens and fetch reproduced uploading A's run as B. Query-cache impact is source-confirmed design risk, not a rendered UI test.
- **Fix:** Scope keys and query keys by authenticated user; cancel old-account work and clear sensitive query state on transition. Design an explicit, safe migration for existing shared data; do not silently assign it to the next account. Apply policy to profile, PR preferences, drafts and pending requests.
- **Fix risk:** High: migration could lose or misattribute existing data. Preserve a recoverable local backup and require an ownership decision.
- **Verify after fix:** A → logout → B; interrupted transition; delayed responses; restart; same exercise IDs; offline login; ensure B never reads/uploads A data. **Blocks submission: Yes.** Apple §1.6, §5.1.1.

### R002 — HIGH — Account deletion does not delete associated application data

- **Evidence:** `server/routes.ts:475-491`; `shared/schema.ts:3-43`; `scripts/migrate.ts:34-40`; `contexts/AuthContext.tsx:113-129`; `lib/auth-storage.ts:24-26`.
- **Problem/impact:** DELETE calls only Supabase Admin deleteUser. Schema contains no auth-user FK cascade; migration removes a legacy workouts FK. No explicit deletion of workouts, feedback, custom exercises, local profile/routes/preferences or query cache exists. Deleted-account local workouts can later sync to a new account. Unknown database triggers could affect server behavior, so live server retention must be checked rather than assumed.
- **Fix:** Implement an idempotent, recoverable deletion workflow covering all application tables, auth identity and local state, with a documented retention policy for backups/logs/email. Avoid a nonrecoverable half-delete across database and Auth API. Confirm service-role availability server-side.
- **Fix risk:** High: destructive operation and cross-service partial failures. Use disposable accounts and staging first.
- **Verify:** Seed every data category; delete; assert table/local/cache absence, session invalidation and safe retry on each partial failure. **Blocks submission: Yes.** [Apple §5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/).

### R003 — HIGH — Offline synchronization loses edits and resurrects deletions

- **Evidence:** `lib/workout-storage.ts:45-64,120-131,135-170`.
- **Problem/impact:** PUT/DELETE fire without durable retries; failures become null. The next GET selects server versions for matching IDs. Offline edits are overwritten, and an offline-deleted workout returns. Login sync handles missing IDs only, not updates/deletions.
- **Fix:** Add an account-scoped durable mutation queue with tombstones and a minimal revision/conflict policy. Reconcile server responses with pending work rather than overwriting them. Surface sync failure/pending status.
- **Fix risk:** Medium/high: duplicate writes, ordering and backwards compatibility.
- **Verify:** Both overwrite and resurrection reproduced against unmodified code. After fix, test restart, intermittent failures, retries and two devices. **Blocks submission: Yes.** Core persistence reliability; Apple §2.1.

### R004 — HIGH — SecureStore chunk transitions retain previous session material

- **Evidence:** `lib/supabase.ts:12-60`.
- **Problem/impact:** Large → small deletes only the count marker, retaining old chunks; small → large retains the unchunked key. Delete removes only the currently indexed representation. Metadata is written before chunks, so partial writes can produce incomplete sessions. Shrinking large payloads also leave trailing chunks. SecureStore remains platform-protected; this is a cleanup/consistency defect, not plaintext storage.
- **Fix:** Use an atomic generation/commit marker strategy or a supported proven adapter, byte-aware chunk sizing, strict metadata validation and bounded cleanup of every representation. Test upgrades and rollback.
- **Fix risk:** Medium: session migration can log users out.
- **Verify:** Mocked large → small → delete retained two chunk keys. Cover reverse transition, shrink, injected write failure, Unicode, restart and actual iOS Keychain behavior. **Blocks submission: Yes.** Sensitive-session lifecycle.

### R005 — HIGH — Hidden exercise pools can generate invalid workouts

- **Evidence:** `lib/exercises.ts:606-611,657-667,794-828`; `app/(tabs)/profile.tsx:800-817`; `app/workout/[id].tsx:125-255` dereferences exercise fields.
- **Problem/impact:** Hiding Easy Pace Run leaves undefined warmup/cooldown objects; hiding required intervals similarly affects the 45-minute variant. Removing all circuit exercises yields infinite rounds in a long EMOM and empty blocks in other formats. Empty pools need explicit handling across categories.
- **Fix:** Validate pools before generation and construct alternatives from remaining exercises; if no valid workout is possible, explain it and allow restoring exercises. Preserve user exclusions. Validate generated domain invariants before persisting.
- **Fix risk:** Medium: selection behavior changes at edge cases.
- **Verify:** Undefined running exercise and infinite EMOM rounds both reproduced; test each removable prerequisite, empty pools, custom-only pools, all durations and sharing/rendering. **Blocks submission: Yes.** Apple §2.1.

### R006 — HIGH — Imported native packages are outside SDK 54's supported set

- **Evidence:** `package.json:27,40,56,55`; `package-lock.json:8199,8662,13495,13509`; `components/ShareWorkoutCard.tsx:4-6`; `app/run/active.tsx:25`.
- **Problem/impact:** Clipboard/sharing use 55-series modules with SDK 54. Maps/keyboard-controller also differ from Expo's supported versions. Risk includes native compile failure and Expo Go JS/native mismatches. No native build has established actual failure.
- **Fix:** After approval, use SDK-aware Expo installation for these packages, regenerate only the lockfile changes needed, assess the existing asset patch and run compatibility diagnostics. Retain required sharing/running functionality.
- **Fix risk:** Medium: API/version differences and existing dependency patch interactions.
- **Verify:** Expo Doctor, Expo install --check, clean install, sharing/clipboard, maps and keyboard interactions on New Architecture iOS. **Blocks submission: Yes, until compatibility verified.** [Official SDK 54 map](https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json).

### R007 — HIGH — Standalone production configuration and environment contract are missing

- **Evidence:** `app.json:1-49`; no eas.json; `lib/supabase.ts:5-6,69`; `lib/query-client.ts:8-17`; `contexts/AuthContext.tsx:116-121`; `.replit:7-11`; `scripts/build.js:499-549`.
- **Problem/impact:** No EAS project linkage/profiles/version policy or production environment mapping. Missing Supabase URL can throw at module load before the React boundary; missing API host breaks sync/feedback, while deletion falls back to HTTP localhost on device. Replit developer environment does not automatically populate EAS builds.
- **Fix:** Confirm owned bundle ID, Expo project and stable hosted API; define validated public configuration and server-only secrets, EAS profiles, build-number management and a qualifying build image. Use one API URL helper. Retain Express hosting and Supabase/Resend services.
- **Fix risk:** Medium: wrong environment may send real data to the wrong project.
- **Verify:** Inspect resolved config and bundled public values without printing secrets; test preview and production against intended services. No localhost/dev host in release bundle. **Blocks submission: Yes.** Apple §2.1; infrastructure prerequisites.

### R008 — HIGH — Privacy policy is unfinished and unavailable within the app

- **Evidence:** `docs/index.html:422-498` contains `[e.g., 30 days]`, omits precise run-location/feedback recipient details and mentions Apple login not implemented. No app route, link or text reference exposes the policy in inspected app code; auth/profile/contact were checked.
- **Problem/impact:** Users cannot readily review policy in-app; actual data movement and deletion are inaccurately described.
- **Fix:** Add an accessible policy link to auth/settings; publish an approved policy at a stable HTTPS URL, documenting routes, fitness data, processors, email copies, retention/deletion, backups and support. Complete App Privacy answers using the inventory.
- **Fix risk:** Low code / material owner policy decisions; do not invent retention promises.
- **Verify:** Open policy from a signed-out fresh install and settings; validate URL availability and consistency with actual deletion and App Store metadata. **Blocks submission: Yes.** Apple §5.1.1(i); [App Privacy details](https://developer.apple.com/app-store/app-privacy-details/).

### R009 — HIGH — Configured app icon is nonsquare and too small for production artwork

- **Evidence:** `app.json:8`; `assets/images/icon.png` is **350×356**, PNG color type 6 (alpha-capable); splash has identical SHA-256. Image inspection confirms baked-in rounded icon/background/shadow.
- **Problem/impact:** Source violates Expo's square-icon guidance and will require stretching/cropping/upscaling. Presence of an alpha channel does not prove transparent pixels or an eventual binary rejection.
- **Fix:** Obtain approved, full-bleed square production artwork, preferably 1024×1024, without baked-in OS rounding. Keep the brand; inspect generated AppIcon assets and final archive.
- **Fix risk:** Low technical; visual approval required.
- **Verify:** Square dimensions, actual opacity, legibility, generated sizes and archive validation. **Blocks submission: Yes, artwork/build validation gate.** [Expo iOS icon guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/#ios).

### R010 — HIGH — Automatic post-merge path invokes destructive schema migration

- **Evidence:** `.replit` postMerge section; `scripts/post-merge.sh:7-13`; `scripts/migrate.ts:34-40`.
- **Problem/impact:** Routine merge hook installs with legacy peer resolution and runs a migration that drops an FK and `users CASCADE`. If pointed at a database retaining that table, this can permanently remove data/dependent objects. Nothing was executed against a database.
- **Fix:** Separate deployment/migrations, replace with reviewed incremental versioned migrations, environment safeguards and tested backups/restore. Determine whether historical users data must be preserved before any schema action.
- **Fix risk:** High if deployed carelessly; do not run the current script as a validation step.
- **Verify:** Disposable database rehearsals with legacy and current schemas, row-count checks and restore test. **Blocks submission: Conditional operational blocker; must resolve before backend rollout.**

### R011 — HIGH — Direct database API authorization cannot be verified

- **Evidence:** `shared/schema.ts:3-43`; `scripts/migrate.ts` creates application tables without RLS/grants/policies. Express storage does check user ownership (`server/storage.ts:33-69,117-129`).
- **Problem/impact:** Express ownership checks do not protect a separately exposed Supabase Data API. The repository provides no evidence of deployed RLS or grants; exposure is **not confirmed** and tables may live in another database/schema.
- **Fix:** Inspect deployed schema exposure and privileges read-only; disable unneeded Data API exposure or establish least-privilege RLS. Preserve Express service-role behavior intentionally; do not assume a publishable key is itself secret.
- **Fix risk:** Medium/high: incorrect policies can interrupt access or expose rows.
- **Verify:** Staging anonymous/A/B direct REST probes, policy catalog review and Express ownership regression tests. **Blocks submission: Conditional, until authorization boundary is established.** Apple §1.6.

### R012 — HIGH — Production permission descriptions and privacy manifest are unverified

- **Evidence:** `app/run/setup.tsx:48`; `app/run/active.tsx:95-149`; `app.json:18-21,36-45`; installed manifest dependency expo-image-picker has no app-source usage found.
- **Problem/impact:** No explicit feature-specific location usage text or permission inventory in app config. SDK 54 legacy auto-plugins can add location descriptions and image-picker camera/photos/microphone descriptions even without explicit plugins. Therefore absence from app.json is **not proof of missing Info.plist keys**. Unnecessary/generic native declarations and required-reason API manifests need generated-artifact inspection.
- **Fix:** Explicit foreground route/distance explanation; retain only required native permissions after usage review. Inspect resolved plugins, generated Info.plist, entitlements, SDK manifests and privacy report. No automatic background-location entitlement is justified by current foreground-only design.
- **Fix risk:** Low/medium: removing a needed permission breaks a feature.
- **Verify:** Clean generated native artifact outside the source baseline after approval; fresh install permission prompts/denial/approximate location; inspect archive manifests. **Blocks submission: Yes, native verification gate.** [Expo permissions](https://docs.expo.dev/guides/permissions/), [SDK 54 automatic plugins](https://raw.githubusercontent.com/expo/expo/sdk-54/packages/@expo/prebuild-config/src/plugins/withDefaultPlugins.ts), [privacy manifests](https://docs.expo.dev/guides/apple-privacy/).

### R027 — HIGH — Converting an exercise can omit existing superset display entries

- **Evidence:** `app/workout/[id].tsx:952-978,1240-1284`; baseOrder derives only from workout.exercises when itemOrder is absent, while newSupersets includes existing pairs plus the new pair. Generated superset workouts have no itemOrder (`lib/exercises.ts:589-602`).
- **Problem/impact:** Generate a workout with a superset, then convert a remaining exercise before reordering. The new order omits existing superset slots and can point at a different pair than the newly converted one. Some exercises/pairs cease to appear even though still persisted, compromising workout editing and sequence.
- **Fix:** Derive initial order from the same complete ordered-items representation used for display, including every existing superset; preserve stable identity when replacing the target slot and verify every item appears exactly once.
- **Fix risk:** Medium: migration of already inconsistent orders and positional handlers. Avoid silently deleting hidden persisted pairs.
- **Verify:** Actual conversion handler with mocked UI/persistence reproduces fewer superset slots than persisted pairs. Cover generated supersets, multiple conversions, reordered workouts, remove/refresh/log and reopen/share. **Blocks submission: Yes.** Core workout behavior, Apple §2.1.

### R013 — MEDIUM — Running lifecycle and permission recovery are unreliable

- **Evidence:** `app/run/setup.tsx:48-89`; `app/run/active.tsx:81-85,95-176,178-188`; `app/workout/[id].tsx:804-850`.
- **Problem/impact:** “Open Settings” invokes Android-only enableNetworkProviderAsync instead of iOS settings. Run setup countdown lacks unmount cleanup. A location watch resolving after unmount can survive cleanup; watch rejection is not handled. Timers count callbacks rather than elapsed time and lose time during suspension. Resume measures distance from the last pre-pause fix, potentially counting paused travel. Setup does truthfully tell users to keep the app open.
- **Fix:** Use Linking.openSettings; guard/cancel async subscriptions, clear countdowns, handle watch errors; use monotonic/timestamp-based elapsed accounting and reset the location baseline on resume. Define foreground/background policy with owner before adding native background behavior.
- **Fix risk:** Medium: timing/distance behavior needs clear acceptance criteria.
- **Verify:** Denied/permanently denied GPS, quick back during countdown/watch start, pause-and-move, device lock, background/foreground, navigation away and stopwatch restart. **Blocks submission: Conditional if tests show core run failures.** Apple §2.1, §5.1.5.

### R014 — MEDIUM — Unsaved runs exist only in process memory

- **Evidence:** `lib/run-store.ts:3-12`; `app/run/active.tsx:203-215`; `app/run/summary.tsx:66-71,96-98`.
- **Problem/impact:** Active run and summary handoff disappear on process death; summary consumes data once. Stop dialog says progress will be saved, but persistence waits for a separate Save action.
- **Fix:** Recoverable account-scoped run draft/checkpoints and transactional summary handoff; align save/discard wording with behavior. Preserve existing explicit discard action.
- **Fix risk:** Medium: duplicate summaries, retained location drafts.
- **Verify:** Kill/relaunch during tracking, stop, summary and save; ensure one saved workout and policy-compliant cleanup. **Blocks submission: Conditional product/reliability decision.**

### R015 — MEDIUM — API validation, resource bounds and abuse controls are incomplete

- **Evidence:** `server/routes.ts:48-82,121-143,410-444`; `server/index.ts:57-66`; no rate limiter found.
- **Problem/impact:** Workout JSON checked largely for id; custom arrays lack element/enumeration validation; feedback assumes strings and most categories lack length limits. Authenticated accounts can write malformed/large records and repeatedly trigger emails. Express default JSON limit is 100 KB, which also risks rejecting long coordinate histories silently through client sync handling.
- **Fix:** Reuse strict domain Zod schemas, cap strings/arrays/numeric ranges, specify a measured route-size policy, add account/IP limits and email quotas at server or verified gateway. Return actionable errors. Do not simply enlarge every body limit.
- **Fix risk:** Medium: reject existing malformed records; plan compatibility migration.
- **Verify:** Invalid types, huge arrays, long runs, duplicates, owner checks, 400/413/429 behavior and mail quota tests with a fake provider. **Blocks submission: Conditional on production abuse/route-size validation.**

### R016 — MEDIUM — Password recovery and mobile auth-link handling are absent

- **Evidence:** `app/(auth)/index.tsx:80-170`; `contexts/AuthContext.tsx:64-111`; `app/+native-intent.tsx:1-6`; `lib/supabase.ts:74`.
- **Problem/impact:** Existing password update requires current password; no forgotten-password action/reset handler. Native incoming paths are all redirected to `/`; URL session detection is disabled. Email-confirmation completion can still work in a browser and should be tested; a broken confirmation flow is not presumed.
- **Fix:** Implement supported recovery flow and allowlisted auth callbacks, verify Supabase site/redirect URLs and templates. Keep generic route fallback safe; do not enable uncontrolled callback token handling.
- **Fix risk:** Medium: token/redirect security and existing link behavior.
- **Verify:** Recovery expired/reused links, cold/warm start, confirmation and email-change links, cancellation and malicious callback inputs. **Blocks submission: Conditional on essential auth-flow testing.**

### R017 — MEDIUM — Authentication initialization and sign-out failures lack recovery

- **Evidence:** `contexts/AuthContext.tsx:47-62,89-92`; `lib/auth-storage.ts:24-26`; `lib/supabase.ts:69-75`; `app/_layout.tsx:46-55`.
- **Problem/impact:** Splash waits on initial auth callback without timeout/recoverable initialization state. signOut's returned error is ignored and UI is set signed-out regardless. No explicit native AppState refresh lifecycle integration exists. These are failure-path risks; normal session initialization was not device-tested.
- **Fix:** Validate config before client creation, expose initialization/storage errors and retry, handle signOut errors intentionally, follow Supabase's native refresh lifecycle guidance with one registered listener. Clear sensitive state consistently with R001.
- **Fix risk:** Medium: session semantics and startup UX.
- **Verify:** Corrupt/missing session chunks, expired refresh token, offline cold launch, network-failed logout and long background expiry. **Blocks submission: Conditional on auth reliability checks.** [Supabase React Native guidance](https://supabase.com/docs/guides/auth/quickstarts/react-native).

### R018 — MEDIUM — Local persistence has lost-write and error-handling defects

- **Evidence:** `lib/workout-storage.ts:76-79,135-150`; `lib/profile-storage.ts:24-31`; `lib/useHiddenExercises.ts:13-22`; `app/(tabs)/index.tsx:287-294`; `app/run/summary.tsx:73-98`.
- **Problem/impact:** Concurrent read/modify/write saves can overwrite each other (reproduced). Profile/preferences JSON parses can reject uncaught; generation/save lacks try/finally and may leave loading state stuck. React render boundaries do not catch asynchronous event-handler failures.
- **Fix:** Serialize per-account storage mutations, validate persisted versions and recover from corruption without silent erasure. Add explicit save failure/retry and loading cleanup.
- **Fix risk:** Medium: local migration and unsaved-work recovery.
- **Verify:** Concurrent save/edit/delete, injected storage failures, corrupt JSON, disk-full and rapid taps. **Blocks submission: Conditional on persistence acceptance tests.**

### R019 — MEDIUM — Release-critical tests and CI are absent

- **Evidence:** `package.json:5-18`; recursive tracked-file discovery found no tests/CI.
- **Problem/impact:** No regression evidence for auth isolation, deletion, offline sync, generator exclusions, navigation or native features. Audit mock reproductions are not a full application test suite.
- **Fix:** Minimal unit/integration tests around these boundaries, then component tests and device smoke tests; CI typecheck/lint/tests/lockfile audit. Avoid a broad framework migration.
- **Fix risk:** Low/medium: tooling compatibility and meaningful fixtures.
- **Verify:** Reproduced defects become failing regression tests before fixes and pass after; CI runs from clean checkout. **Blocks submission: Yes, evidence gate.**

### R020 — MEDIUM — History and GPS work scale without bounds

- **Evidence:** `server/storage.ts:33-38,86-98,117-122`; `shared/schema.ts`; `lib/workout-storage.ts:21-33,99-131`; `app/run/active.tsx:98-120,122-129,272-275`; `app/(tabs)/contact.tsx:318`.
- **Problem/impact:** Full workout history (including every route) is fetched and rewritten as one JSON string. Tables lack declared user/time indexes and pagination. Every fix copies route arrays and every timer render remaps the full polyline; high-accuracy continuous GPS affects battery. Performance impact is inferred, not measured.
- **Fix:** Measure representative long histories/runs, add user/date indexes and pagination, avoid carrying full routes in list responses, bound/simplify display coordinates without losing stored route fidelity. Memoize only measured expensive work; retain History's existing FlatList.
- **Fix risk:** Medium: API pagination and map accuracy tradeoffs.
- **Verify:** Old iPhone profiling, multi-hour route, thousands of workouts, query plans, payload size and battery traces. **Blocks submission: Conditional on profiling.**

### R021 — MEDIUM — Production API logging exposes response fragments and raw errors

- **Evidence:** `server/index.ts:72-103,212-229`; `server/routes.ts:335,380-386`.
- **Problem/impact:** All API JSON responses are serialized into log text before the final 80-character truncation. This can record identifiers or content fragments; it does not prove full routes are logged. Generic error middleware returns raw error.message and admin responses expose upstream details. No retention/redaction/diagnostic monitoring policy is provided.
- **Fix:** Log status, duration, safe request ID and approved fields only; redact user data; generic production errors; restricted structured server diagnostics and agreed retention. Native error details are already gated by __DEV__.
- **Fix risk:** Low: preserve enough diagnostics for operations.
- **Verify:** Seed marker PII, assert absence from logs/error responses; verify retention and alerting. **Blocks submission: Conditional on actual production logging policy.**

### R022 — MEDIUM — Repository archive includes hidden historical development state

- **Evidence:** root `Workout-Generator.zip` (5,867,329 bytes), [413-entry archive inventory](evidence/archive-inventory.json): nested `.git/`, `.expo/`, `.local/state/replit/agent/` binary files.
- **Problem/impact:** Duplicate outdated source/history/cache creates accidental disclosure and packaging ambiguity. No credential exposure was confirmed. 35 archive text entries had no matches in the bounded scan; embedded object history/binary state is unverified. Being committed does not mean these files are necessarily bundled by Metro.
- **Fix:** Retain an approved offline backup if needed; remove archive/dev-state from shipping/build context only after preservation and reference review; adjust ignore/build-exclusion rules for server_dist/static-build/attachments as appropriate. Do not rewrite history without separate authorization.
- **Fix risk:** Low/medium: possible backup loss, evidence retention needs.
- **Verify:** Build upload inventory and bundle assets exclude archive/dev state; history handling documented. **Blocks submission: Conditional if sensitive state enters distributed artifacts.**

### R023 — MEDIUM — Resend key is effectively mandatory at server startup

- **Evidence:** `server/routes.ts:8-12`, locked Resend 6.12.2; [versioned Resend constructor](https://raw.githubusercontent.com/resend/resend-node/v6.12.2/src/resend.ts).
- **Problem/impact:** Construction throws without a key before the warning that emails will merely be disabled. Backend cannot start in that documented degraded mode.
- **Fix:** Either require/validate the key explicitly as part of the environment contract, or instantiate mail delivery conditionally and report degraded capability. Do not send live emails in tests.
- **Fix risk:** Low: define whether missing email is fatal.
- **Verify:** Start isolated server with mail configured and absent using fake credentials/provider, check account/workout API availability as specified. **Blocks submission: Conditional if key is absent.**

### R024 — MEDIUM — Core controls lack accessible names and gesture alternatives

- **Evidence:** `app/(auth)/index.tsx:68-75` password icon; `app/run/active.tsx` pause/stop/map controls; `components/SortableExerciseList.tsx:145-230` drag gesture; `app/workout/[id].tsx:804-850` stopwatch gesture. Explicit accessibilityLabel/Role search found them only in ErrorFallback.
- **Problem/impact:** Icon-only actions and long-press/drag-only operations can be undiscoverable with VoiceOver. Dynamic Type, contrast, focus order, form labels and effective target sizes have no device evidence. Visible text buttons may already receive useful names; no blanket claim that all controls are inaccessible.
- **Fix:** Add names/roles/state and equivalent accessible reorder/stop actions; verify forms, modal focus, errors and text scaling. Audit effective 44-point targets rather than treating every small icon as a small target.
- **Fix risk:** Low/medium: assistive navigation semantics.
- **Verify:** VoiceOver end-to-end, maximum Dynamic Type, increased contrast/reduced motion, small/large iPhones and keyboard. **Blocks submission: Conditional on essential feature accessibility.**

### R026 — MEDIUM — Personal records compare incompatible units directly

- **Evidence:** `app/(tabs)/profile.tsx:100-171` computePRs compares ex.weight directly; `app/(tabs)/profile.tsx:202-235` computeJustRunPRs chooses per-run miles/km distance and pace, then compares raw values.
- **Problem/impact:** 220 lb is selected over 100 kg even though 100 kg is heavier. A 7 km run can outrank 5 miles, and 6 min/km can outrank a faster 8 min/mile. Switching units between sessions makes PR results incorrect.
- **Fix:** Compare normalized canonical weights/distances/pace while retaining original units for display and preserving stored history. Use deterministic tie rules; do not rewrite user data just for presentation.
- **Fix risk:** Low/medium: conversion precision and expected displayed unit choices.
- **Verify:** Both weight and run defects reproduced using actual extracted profile functions. Test mixed units, ties, reset boundaries, zero/invalid values and displayed records. **Blocks submission: Conditional; correct before shipping advertised PR tracking.**

### R025 — LOW — Documentation drift and dependency/build hygiene complicate maintenance

- **Evidence:** `replit.md:5-7,31-37`; `package.json` scripts/dependencies; `components/KeyboardAwareScrollViewCompat.tsx`; `.gitignore`.
- **Problem/impact:** Docs claim Google/Apple login, memory storage and incomplete tab list. A compatibility component has no static inbound references. Candidate unused packages include legacy JWT/bcrypt/proxy/pg/validation/polyfills, but font/web/native/config packages cannot be removed just for missing imports. `server:build` calls esbuild without declaring it directly; it currently exists transitively. Generated server/static directories lack explicit ignore entries. POSIX environment-assignment scripts do not run unchanged in PowerShell.
- **Fix:** Correct architecture/runbook; classify dependencies by runtime/tool/plugin/peer use and inspect lock graph before removal; declare directly invoked tools; add portable local commands if Windows support is desired. Keep config entry points, Metro map mock, route files and referenced assets.
- **Fix risk:** Low if limited; package removals can break autolinking/builds.
- **Verify:** Clean npm install and scripts, import/plugin resolution, web and iOS smoke checks. **Blocks submission: No independently.**

## iOS and Apple assessment

| Topic | Assessment |
|---|---|
| Completeness/stability (§2.1) | Potential noncompliance: reproduced generator/sync defects; production binary not tested. |
| Privacy/security (§1.6, §5.1.1) | Material defects R001/R002/R008; deployed RLS unknown. |
| Login services (§4.8) | Likely not applicable to current email/password-only implementation. Supabase as backend provider does not itself mean social login. Reassess if Google/Apple is added. |
| Account access without login (§5.1.1(v)) | Manual/product review: all tabs require login even though generation runs locally. Evaluate optional guest access or document why account features are essential; do not remove the gate without approval. |
| Payments (§3.1.1/§3.1.2) | No purchases/subscriptions/payment integration observed. Requirements not applicable to current inspected product; business model confirmation outstanding. |
| UGC (§1.2) | Feedback/custom exercises are private/account scoped in code; no public feed or messaging observed. Public moderation requirements not established as applicable. Confirm no external public feature. |
| Tracking/ATT (§5.1.2) | No ad/analytics/cross-app tracking integration observed. ATT requirement not established. Confirm processors' actual practices and compiled SDKs. |
| Health/fitness (§5.1.3) | Fitness logs and local BMR estimates present; no HealthKit/research integration observed. Confirm claims, age suitability and privacy disclosures; do not market estimates as medical advice. |
| Location (§5.1.5) | Functional justification exists for Just Run; actual native declarations and denial/recovery need validation. |
| Minimum functionality (§4.2) | Likely adequate native functionality based on source; no executed review experience. |
| IP/branding (§5.2) | Owner must confirm rights to art, exercise content, fonts and branding; not verifiable from code. |
| Metadata/access (§2.3) | Manual: valid privacy/support URLs, screenshots, age questionnaire, app description, reviewer credentials and live backend. Existing docs support page is not evidence of published/reachable metadata. |
| Accessibility | Material gaps R024; no VoiceOver/device checks passed. |
| Export/signing | Manual: standard encryption exemption assessment, developer membership, agreements, bundle ownership, signing profiles/certificates and App Store record. No credentials accessed/created. |

Guideline references link to the [official current App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). These are source-based assessments, not Apple approval. Current Apple upload requirements were consulted; recheck immediately before release.

## Cleanup and architecture recommendations

No circular dependencies were found in the static literal-import graph. This is not a proof about computed imports/native initialization cycles. The graph and incoming-reference list are in evidence. The unreferenced compatibility component is a cleanup candidate, not confirmed safe deletion. Config scripts, CLI/server entry points, route-convention files and the web map mock are runtime/tool references. Splash and icon are exact duplicates, intentionally referenced separately; do not delete either path without a configuration change. Attached screenshots/pasted requirements and the ZIP are source-control/build-context candidates, not automatically bundled app assets.

Keep the current screens/design and extract business/persistence boundaries incrementally as fixes require. The large profile and workout-detail modules combine UI, PR calculations, forms and persistence; smaller domain helpers would improve testability, but a wholesale rewrite is not warranted. Highest-value shared abstractions are account-scoped persistence, a consistent API client, validated domain data and a small sync queue. Maintain existing error boundaries, FlatList history rendering, safe-area handling, SecureStore intent and server-side token/owner/admin checks.

Next action: review [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md). **Application remediation is paused at the user's required approval checkpoint.**

## November 2 — Latest technical preparation update

EAS configuration, square icon, startup recovery and client password reset are now implemented. SDK validation passes; dependency high entries are reduced from 19 to 7 after documented triage. Native sessions remain Keychain-backed with device-only availability after first unlock for background tasks. Unused native permissions were removed after source review. See [beta preparation/setup and verification](BETA_PREPARATION_UPDATE.md), [dependency triage](DEPENDENCY_TRIAGE.md) and [current status](RELEASE_READINESS_SUMMARY.md). Earlier audit text remains a baseline/historical snapshot. Hosted Supabase settings, real account/email flows, native builds, signing, device tests and release authorization gates remain open. No production action occurred.
