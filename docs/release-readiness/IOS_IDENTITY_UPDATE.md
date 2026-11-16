# iOS identity correction — November 5, 2026

The developer confirmed the existing App Store Connect bundle ID is `app.replit.swolehouse`. The previous EAS attempt failed because `com.forge.app` was unavailable to the selected Apple team. Earlier audit reports and introspection artifacts describe the configuration at that time; this update supersedes their iOS identity references.

- Set `expo.ios.bundleIdentifier` to `app.replit.swolehouse`.
- Update the release preflight and configuration tests to require that identifier and reject the former iOS identifier.
- Leave the Android package unchanged; this decision concerns the existing iOS app.
- Keep `swolehouse` as the URL scheme, preserving authentication callback URLs.

The developer's Replit checkout has newer deployment/environment changes than this local checkout. Transfer these specific edits or merge them with review; do not overwrite the Replit checkout with the older local snapshot.

Before rebuilding, verify the resolved iOS identifier with `npx expo config --type public`, run the release preflight with the intended environment and run the tests. Commit the changes, then run `npx eas-cli@latest build --platform ios --profile testflight`. Use a build number greater than any already uploaded for the same version. EAS manages the remote build number; the last reported attempt incremented it to 6 but did not finish.

A successful new upload adds a build to the existing app record. It does not overwrite the previous binary or publish an App Store release. Apple team access, provisioning compatibility, native build success and device behavior remain unverified. No Apple identifiers, signing credentials, builds or uploads were created or changed by this local correction.

Local verification: all 61 tests pass, including rejection of the former iOS identifier; TypeScript and `git diff --check` pass. The initial sandboxed test run could not spawn workers (EPERM); the permitted rerun passed.
