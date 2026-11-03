# Security and privacy review

> November 1 remediation update: implementation is underway in the dedicated checkout. The initial zero-advisory result is superseded by an online baseline result of 61 and a current result of 47 (0 critical). See [remediation progress](REMEDIATION_PROGRESS.md) for tested fixes, limits, and follow-up R028. The original audit below describes the baseline commit.

Date: October 30, 2026. Overall security gate: **NOT READY**. See findings R001–R027 in [AUDIT_REPORT.md](AUDIT_REPORT.md) for severity, exact source references, fix risk and verification.

## Verified controls and gaps

Server endpoints validate Bearer sessions with Supabase `getUser(token)` and derive user IDs from verified Auth results (`server/auth.ts:20-33`), rather than trusting a client-supplied owner ID. Workout/custom-exercise reads and updates check ownership in DbStorage; admin endpoints enforce configured email allowlists server-side. Database statements use Drizzle/postgres parameterization. Feedback HTML is escaped before interpolation. No confirmed SQL injection or admin-auth bypass was found in inspected paths.

Native session tokens are intended to use SecureStore rather than AsyncStorage; the web fallback uses localStorage. The custom chunk adapter leaves stale session representations and is not atomic (R004). Logout does not isolate/clean user workout/profile/cache state; signing into another account can upload the previous account's run routes (R001). Account deletion lacks app-table/local cleanup (R002). Do not interpret correct API ownership checks as protection against the client's account-misattributed uploads.

The application generally derives API requests using HTTPS, but deletion falls back to HTTP localhost if a public domain is missing (`contexts/AuthContext.tsx:116-121`). The Express service relies on its hosting layer for external TLS; PostgreSQL transport enforcement and host certificates were not verified. Connection-string re-encoding in `server/db.ts:10-29` also assumes the password was not already URL encoded; test both encoded/raw supported inputs before adjusting it. CORS restricts known Replit/localhost web origins but is not an authorization control for native clients. A custom production web origin requires deliberate CORS configuration.

Input schemas, size budgets, email quotas and rate limits are incomplete (R015). Responses are partly logged and errors can return internal messages (R021). No WebView, contact access, Bluetooth, HealthKit, advertising network, purchase SDK or push notification SDK was identified in current app imports. Native linked dependencies and hosted service practices require a second privacy review against the actual release archive.

## Credentials and exposure review

No actual secret values are included in this report or scan evidence. Heuristic scanning of working text and **268 unique reachable historical text blobs across 122 commits** produced no candidate matches for the selected private-key, service-token, JWT, literal-sensitive-assignment and credential-URL patterns. The scan deliberately reports only locations/types, never matching values. This does not establish absence of obfuscated secrets, unknown token formats, unreachable Git objects, remote history, LFS content, environment configuration, credentials in images or compiled/binary state.

`Workout-Generator.zip` contains 413 entries including old `.git`, `.expo` and Replit binary agent state. A narrower scan of 35 text entries found no candidates. Its nested historical objects and binary agent state were not secret-scanned; preserve privately and inspect before sharing or removing. No credential compromise was confirmed, so no rotation was performed. If a later scan confirms a secret, revoke/rotate through its provider with authorization and assess recipients/history; deleting a file alone does not revoke it.

| Variable / value class | Classification | Boundary and required handling |
|---|---|---|
| EXPO_PUBLIC_SUPABASE_URL | Public client project endpoint | Bundled intentionally; validate intended project. |
| EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public client configuration | Publishable/anon keys are not admin credentials; their safety depends on server authorization and Data API policies. Never substitute a service-role/secret key. |
| EXPO_PUBLIC_DOMAIN | Public API hostname | Bundled intentionally; stable HTTPS production backend required. |
| SUPABASE_SERVICE_ROLE_KEY | Privileged secret | Express account deletion only; server env, never client bundle. |
| SUPABASE_CONNECTION_STRING | Privileged database credential | Server/migration env only; least-privilege access and verified TLS. |
| RESEND_API_KEY | Privileged mail credential | Server only; quotas, restricted sender and protected logs. |
| ADMIN_EMAILS / ADMIN_EMAIL | Authorization configuration / personal recipient | Server configuration; not a password, but avoid unnecessary exposure. |
| Access/refresh tokens | Sensitive user session | Secure native storage; no reports/logs; clean all representations on sign-out/deletion. |
| Bundle ID, URL scheme, Resend domain ID | Public identifiers | Not secrets. Ownership and correctness need confirmation. |

No `.env` or signing private key is tracked in the current main tree. Ignore rules cover `.env`, local env files and common signing formats; other env filename patterns/history still require review. Privileged env references are server-side in the inspected import graph. Their actual values and the final bundled app have not been inspected.

## Data inventory

“Collected off device” distinguishes Apple disclosure candidates from data used only locally. These are implementation observations; provider-side logs, region, backups, sub-processors and deletion deadlines require owner confirmation.

| Data category | Purpose and evidence | Storage / recipients | Retention and deletion | Disclosure / consent assessment |
|---|---|---|---|---|
| Email, name, account UUID, created-at, optional avatar metadata | Registration/session display; `contexts/AuthContext.tsx:17-26,72-78` | Supabase Auth; native session metadata in SecureStore; web localStorage; email/UUID also in feedback PostgreSQL rows | Auth delete exists; associated records/local caches not comprehensively removed | Likely Contact Info + Identifiers linked to user, App Functionality. Name/email needed only for declared purposes. Avatar metadata is read, but an upload/photo feature was not found. |
| Password and auth/session tokens | Login, reauthentication, session refresh | Supabase Auth receives password over HTTPS; tokens in SecureStore/web localStorage and Bearer API headers | Chunk leftovers and ignored logout errors require remediation; provider security/retention unknown | Sensitive credentials must not be logged; do not describe passwords as stored locally by this app. Confirm processor handling. |
| Exercises, sets/reps, weights, timestamps, workout notes, PR history | Generation, history, exercise logging and PRs | AsyncStorage; Express/PostgreSQL; hosted log fragments possible | No reliable retention/deletion policy; offline delete can return | Likely Fitness and user content as appropriate, linked to user, App Functionality. Free-text notes may contain additional sensitive content. |
| Precise latitude/longitude plus timestamps, run distance/duration/pace | Just Run route/distance and history maps; `RunData` in workout JSON | In-memory tracking → AsyncStorage → Express/PostgreSQL; Apple Maps/platform service involvement needs provider review | No clear retention bound; draft dies with process; saved routes remain after account deletion locally | Likely Precise Location + Fitness linked to user. Just-in-time foreground location permission exists; policy must explain server sync and retention. Approximate/denied location must be supported appropriately. |
| Gender selection, age, height, weight, units, fitness goal, BMR estimate | Profile/BMR calculation; `lib/profile-storage.ts:5-15` | Device AsyncStorage; no explicit server profile endpoint or profile sync found | Device-global; not cleared by logout/deletion | On-device-only processing is generally outside Apple's off-device collection definition; still sensitive personal data requiring accurate policy/security. If transmitted by future telemetry, reassess Health/Fitness/Other Data categories. |
| Hidden exercise IDs / PR reset timestamps | Personal customization | Device AsyncStorage | Shared device keys, no deletion integration | Local only in inspected paths; isolate per account. |
| Custom exercise names, muscles, equipment, categories, created-at | Personal exercise library | Express/PostgreSQL; React Query cache | No account-table cascade or local query transition cleanup | Likely Fitness / Other User Content linked to account, App Functionality. No public sharing service observed. |
| Feedback text, selection, category, date, user ID/email | Support/exercise requests | PostgreSQL; Resend; admin notification mailbox and confirmation email recipient (`server/routes.ts:141-229`) | No retention deadline; Auth deletion does not remove rows/mail copies | Customer Support / Other User Content and Contact Info linked to user. Confirm whether optional-support disclosure exception applies; do not assume all feedback is exempt. |
| Shared workout/run card PNGs, aggregate stats/date, exercise names | User-initiated export/copy | Temporary file/base64; OS clipboard/share destinations chosen by user | No explicit temp-file release in share helper; OS/library lifecycle needs verification | Sharing is user initiated. Current run share card shows aggregate stats, not route map. Explain intentional export; recipients' retention outside app control. |
| IP addresses, request timing/path/status, identifiers/response fragments, errors | Hosting, abuse prevention, diagnostics | Replit/Express/Supabase/Resend platform logs; QR CDN receives marketing-page requests | Log policy/access/expiry unknown | Confirm Diagnostics/Identifiers/Other Data disclosure based on actual off-device retention and use; no device-info telemetry endpoint was found despite website policy claiming collection. |
| App assets/fonts and platform map requests | Visual display/navigation context | Bundled Rubik/images; react-native-maps platform provider | SDK/provider cache policies unknown | Font package is bundled, not evidence of Google advertising tracking. Map SDK/platform behavior must be reviewed on the binary/network trace. |

## Apple privacy and permission assessment

Prepare App Store Connect answers using actual off-device collection and processor behavior, including linked account identifiers, email/name, fitness logs, precise location and feedback. No tracking behavior was established from current source. ATT is conditional on cross-app/site tracking or advertising identifier practices; do not add an ATT prompt merely because location is used. Confirm this against SDKs, hosting, business practices and the compiled archive. See [Apple's data definitions](https://developer.apple.com/app-store/app-privacy-details/) and [tracking guidance](https://developer.apple.com/app-store/user-privacy-and-data-use/).

App Privacy answers, privacy policy, iOS usage strings, ATT consent and required-reason privacy manifests are separate obligations. A policy does not replace a location prompt; a permission prompt does not justify undisclosed server retention. Inspect final PrivacyInfo.xcprivacy aggregation and required-reason declarations from AsyncStorage/native dependencies; absence of a checked-in manifest alone does not prove binary noncompliance. See [Expo privacy manifests](https://docs.expo.dev/guides/apple-privacy/).

Observed runtime permission request: **foreground location**, triggered by Start Run. There is no runtime camera, microphone, photos, contacts, Bluetooth, motion or push request in app code. Run “notifications” are in-app text/haptics, not APNs. SDK 54 auto-plugins can still add camera/photos/microphone descriptions through the currently unused image-picker dependency, and generic Always location descriptions through expo-location. Inspect generated Info.plist before deciding what is unnecessary. App uses clipboard writes and native sharing; these do not by themselves require a blanket photos permission. Do not add background modes without an approved background feature.

## Owner confirmations required

- Actual Supabase Data API exposure, grants, RLS/triggers and auth/session settings; database region/backups and deletion behavior.
- Replit logging/TLS, operational retention, processor/sub-processor agreements and incident/access practices.
- Resend recipient retention and administrator mailbox deletion process.
- Accurate policy deadline, public HTTPS privacy/support URLs, account deletion semantics and age/business-model choices.
- No undisclosed analytics, remote SDK configuration, ads, public community features or data brokerage outside the inspected source.
- Final native permissions, privacy manifests, device network traces and App Store Connect disclosures.

The first actions are R001 and R002 with regression tests and a safe migration/deletion design, not cosmetic cleanup or blanket credential rotation.

## November 1 — Background location and creator ownership update

The baseline issues above are historical findings, not assertions that all remain unchanged. New private records are scoped to their creating authenticated account, and unowned legacy data is preserved without assignment/import. Run drafts now contain precise coordinates/timestamps recorded while a user-started run/walk is backgrounded or locked. Drafts stay in account-scoped AsyncStorage until save/discard; logout pauses and preserves them for their owner. Secure session ownership is checked by headless tasks; tokens are never copied into drafts or the active run binding. Saved routes enter the existing owner-scoped local mutation queue and Express/PostgreSQL sync path. No new route-upload/advertising SDK was introduced. Update the privacy policy and likely account-linked precise-location/app-functionality disclosure before release. Native map/OS traffic, actual retention, backups and R002 deletion remain unverified. See ACCOUNT_AND_BACKGROUND_RUN_UPDATE.md for full data flow, limits and tests.

## November 2 — Latest technical preparation update

EAS configuration, square icon, startup recovery and client password reset are now implemented. SDK validation passes; dependency high entries are reduced from 19 to 7 after documented triage. Native sessions remain Keychain-backed with device-only availability after first unlock for background tasks. Unused native permissions were removed after source review. See [beta preparation/setup and verification](BETA_PREPARATION_UPDATE.md), [dependency triage](DEPENDENCY_TRIAGE.md) and [current status](RELEASE_READINESS_SUMMARY.md). Earlier audit text remains a baseline/historical snapshot. Hosted Supabase settings, real account/email flows, native builds, signing, device tests and release authorization gates remain open. No production action occurred.
