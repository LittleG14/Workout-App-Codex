# Beta preparation: build configuration, startup and authentication

Implementation November 1–2, 2026; final verification November 2. Implemented in the existing `codex/ios-release-readiness` checkout. **Requested local technical preparation is implemented; overall release status remains NOT READY.** The Expo project/environment and hosted authentication still require setup/verification, and no native build or device validation has occurred. This report supersedes earlier statements that EAS configuration, the square icon, startup recovery or password-reset UI are absent.

## EAS profiles and app identity

`eas.json` now contains:

| Profile | Distribution / environment | Purpose |
|---|---|---|
| base | Shared Node 22.23.3 and iOS `sdk-54` image | Parent settings; use a named child profile. |
| preview | Internal / preview | Standalone testing on registered iPhones, without Metro. Requires the appropriate device provisioning/signing approval. |
| simulator | Internal / preview; iOS simulator | Standalone simulator testing. Still an actual build and not executed. |
| testflight | Store / preview; auto-increment | TestFlight binary pointed at test services. |
| production | Store / production; auto-increment | Eventual production service environment. |

CLI configuration uses remote build versions and requires committed source. Submission profile placeholders contain no fabricated Apple account/app IDs or credentials; select/configure the real app record only at an authorized upload step. TestFlight and production share the existing app identity, so they are not separate side-by-side installations.

`app.json` retains `com.forge.app`, `swolehouse`, version 1.0.0, portrait orientation, iPhone-only support and New Architecture. `app.config.ts` preserves that config and accepts the real `EAS_PROJECT_ID` UUID and optional `EXPO_OWNER` from the environment. It does not create or link an Expo project. The old Replit router-origin override was removed.

**Verified locally:** bundle ID/config consistency and syntax, icon source, SDK compatibility and resolved native permissions. **Not verified:** registration/ownership of `com.forge.app`, Apple team access, Expo account/project ownership or signing. No identifiers were reserved or changed remotely.

The `sdk-54` image currently maps to Xcode 26.0, consistent with Apple's upload SDK floor. Reconfirm availability/toolchain in the first authorized build; SDK compatibility checks do not establish native compilation success. [Expo infrastructure](https://docs.expo.dev/build-reference/infrastructure/), [Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/).

## Environment preflight

`scripts/validate-release-config.cjs` is available as `npm run validate:release` and the EAS pre-install hook. It rejects missing/placeholder endpoints, malformed project IDs, localhost API hosts and privileged Supabase keys, while reporting field names only. It makes no network calls. Current local execution **correctly exits 1** because the intended service configuration/project ID have not been supplied. Fake values used by unit tests/JS exports are not release configuration.

Before any build, configure these in the appropriate EAS environment and make the project ID available to local config resolution:

- `EXPO_PUBLIC_DOMAIN`: public API hostname only, with no protocol/path. Express must be hosted separately and reachable over HTTPS.
- `EXPO_PUBLIC_SUPABASE_URL`: intended HTTPS project endpoint.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public publishable/anon client key; never a secret/service-role key.
- `EAS_PROJECT_ID`: actual linked Expo project UUID.
- Optional `EXPO_OWNER`: actual Expo account/organization.

Use separate preview and production service configuration. Do not put database, service-role, mail or signing secrets in public mobile variables. Avoid forcing `NODE_ENV=production` before dependency installation, which can omit required development/build tools. No `.env`, EAS environment or production service was populated or changed by this round. Commit the reviewed changes before an authorized build, as `requireCommit` intentionally enforces.

## Icon and permission configuration

The original 350×356 icon was a rounded mockup on a gray surround. A sibling asset, `assets/images/icon-ios.png`, is now a **1254×1254 opaque RGB PNG**, with no alpha/tRNS transparency, gray surround, baked outer rounded corners or mockup shadow. It keeps the orange gradient and black house/barbell motif. It is the global/iOS icon and Android adaptive foreground source. Original assets remain intact. Expo Doctor's asset checks pass. Expo's native icon pipeline will derive the required iOS sizes; the generated AppIcon/1024×1024 archive rendition still needs inspection after an authorized native build. Android adaptive appearance also remains untested.

Source search found no camera, microphone, photo-library picker or biometric-authentication calls in app/lib/components/server/shared. Explicit image-picker permission overrides now remove the otherwise auto-added unused camera/microphone/photo usage descriptions. SecureStore is configured without Face ID and with Android backup exclusion rules. Introspection confirms only the intended location usage descriptions and `location` background mode; this is not an archive privacy-manifest certification.

The built-in image-generation tool was used with the existing icon as edit target. Exact prompt:

```text
Edit target: attached existing Swole House app icon. Produce a production iOS app icon asset, exactly square 1024 x 1024 pixels, opaque RGB PNG with no alpha. Preserve the same black combined barbell/house silhouette and four-pane window, its shape and proportions, and orange gradient branding. Remove the surrounding gray tabletop/background, mockup drop shadow, beveled edge, and baked rounded outer corners. Extend the orange gradient to all four straight square edges, full bleed; iOS will apply the corner mask. Center the existing black mark with generous balanced padding, keep all black mark details intact. No text, no extra elements, no redesign. This is format/framing correction of the existing artwork.
```

The tool returned 1254×1254 rather than the requested 1024×1024. The larger square source was retained; its square/opaque format was verified rather than silently asserting an exact output size.

## Recoverable startup

- Supabase configuration is checked without throwing during module import. An invalid configuration uses an inert client whose network calls are blocked and reaches a clear support/configuration message.
- Session initialization and font loading have 15-second deadlines. Errors/timeouts hide the native splash and render a system-font failure screen with **Try again**. Retry remounts initialization, unsubscribes old auth listeners and rejects updates from the discarded provider.
- Supabase network requests have abort-based timeouts. Callback, reset-email and password-update operations also have bounded UI waits. Timeout wording for password mutation acknowledges that the server may have completed the update.
- Existing account/cache isolation remains active. Startup retry does not erase workouts or silently discard a saved run/session.

A persistent native Keychain/OS failure may still require closing/reopening or updating the app. The error screen makes the failure visible; it does not claim to repair native corruption or missing build configuration. Native failure injection/UI testing remains required.

## Password reset, redirects and session persistence

Password recovery was missing. It now has a sign-in **Forgot password?** link, reset-email form, dedicated callback and new-password/confirmation form. The request uses Supabase `resetPasswordForEmail`; the callback exchanges a one-time authorization code using PKCE. Recovery authority comes from the SDK's verified `PASSWORD_RECOVERY` redirect marker stored with its secure verifier, not a URL query flag. Normal signup/email-change callbacks cannot enable the reset form. Passwords must match and have at least 8 characters; the project may impose stronger requirements.

Only the exact native callback `swolehouse://auth/callback` or the current explicit web callback origin is accepted. Native intents are length-bounded, reject token fragments/foreign endpoints and forward a clean route without putting authorization codes into router parameters. Web callbacks scrub the code from browser history. Code exchange is deduplicated across remounts; errors never echo the URL/token/provider error text. Recovery authorization is owner-bound, short-lived, and consumed after a successful reset. The password update targets the captured verified session token, so a concurrent account switch cannot direct it at the next account.

Signup and email changes now request the same callback. Native sessions and PKCE verifiers stay in the versioned SecureStore adapter; web retains browser localStorage. Native PKCE receives Expo-backed random values/SHA-256 instead of accepting the SDK's weak/plain fallback in unsupported runtimes. Browser recovery requires a secure origin (localhost is allowed for development). AppState-driven token refresh remains in place.

New native Keychain writes use **AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY**: background tasks can read their persisted owner while the screen is locked after the first unlock, and these credentials do not migrate to another device. This trades stricter when-unlocked availability for the explicitly requested background feature while retaining Keychain protection. Pre-existing items adopt the new class when rewritten by sign-in/refresh; sign out/in once on an older installation before locked-session testing. After reboot, an initial device unlock is still necessary. No credential values were read into reports or changed on a live account.

**Important limitations:** PKCE emails must be opened on the same installation/browser that requested them. Requests replace the stored verifier, so use the newest email. Old implicit/token-fragment links are deliberately rejected; request a fresh email. If the app restarts after code exchange but before password completion, request a new reset email. No reset/confirmation email was actually sent, and no real account password was changed during verification.

## Supabase dashboard steps still required

1. Confirm the intended project and email/password provider settings. Inspect existing redirect allowlist/site URL and email templates before modifying them; this repository cannot prove their hosted state.
2. Allowlist exactly `swolehouse://auth/callback` for installed builds. If shipping/testing web, also allowlist that actual HTTPS origin's `/auth/callback` (and a narrowly scoped localhost URL only for development). Avoid unrestricted production wildcards.
3. Ensure signup, password recovery and email-change templates preserve the appropriate Supabase confirmation URL/redirect rather than a hardcoded Replit/SiteURL destination. The default `{{ .ConfirmationURL }}` pattern must remain consistent with the flow. The Supabase SMTP/email service is distinct from the Express feedback Resend integration.
4. Verify SMTP sender/deliverability, quotas, expiry and password policy using disposable staging accounts, with authorization for real email/account actions.
5. Test cold/warm email links, valid/expired/reused links, newest-email behavior, different-device rejection, interrupted recovery, email confirmation/change and A/B account switches in the installed binary. Record results; none are currently device-certified.

References: [Supabase mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), and installed `@supabase/auth-js` PKCE exchange/verifier code.

## Dependency and verification result

All 19 prior high-rated package entries have a recorded disposition in [DEPENDENCY_TRIAGE.md](DEPENDENCY_TRIAGE.md). Compatible updates/targeted overrides reduce high entries to **7**, with **0 critical, 52 moderate and 2 low (61 total)**. Increased aggregate/moderate counts are explicitly retained in the raw scan; this is not a clean audit. The remaining high entries were not waived and CI's high-severity audit gate remains failing.

Generated verification exports are excluded from ESLint; a final run had initially scanned the minified web bundle, which was corrected without suppressing application rules. Requested local checks pass: **61 tests**, TypeScript, ESLint (**0 errors/23 warnings**), SDK dependency check and **Expo Doctor 18/18**. Native configuration introspection, iOS Hermes JavaScript export and web/CSS export also pass; exports use placeholders and are not native release binaries. Server compilation and the existing expo-asset patch pass. See TEST_REPORT.md and `evidence/beta-verification.json` for commands/results.

No signing, native/EAS builds, Apple/Expo account creation, upload, TestFlight processing, production database modification, hosted auth change or App Store submission occurred. Those remain explicit authorization gates. Existing deletion/retention, hosted authorization, API limits, cross-device conflicts, privacy policy/disclosures, accessibility and real device/performance findings remain open as described in RELEASE_READINESS_SUMMARY.md.
