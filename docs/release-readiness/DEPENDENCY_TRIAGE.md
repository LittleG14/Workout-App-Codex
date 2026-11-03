# Dependency triage for the 19 prior high-rated entries

Reviewed November 1–2, 2026. Baseline for this round: `evidence/background-npm-audit.json` (47 package entries: 19 high, 26 moderate, 2 low, 0 critical). Current online scan: `evidence/beta-npm-audit.json` (**61 package entries: 7 high, 52 moderate, 2 low, 0 critical**). Counts are affected package entries, including inherited severity; they are not counts of separately demonstrated exploits. Aggregate counts have increased even though high entries fell. Unique advisory URLs fell from 52 to 16, with no new advisory URL in the final report; see evidence/beta-advisory-delta.json. The affected-package count and advisory count measure different things. The current raw report is retained without filtering; no zero-vulnerability claim is made.

Only compatible parent-range updates and two explicit transitive overrides were applied. No `npm audit fix --force`, Expo major upgrade/downgrade, ORM/schema major transition, production migration or dependency removal was performed. All installed native packages still pass SDK 54 validation.

## Disposition of every prior high entry

“No finding” means this named package has no current audit entry, not proof of absence of every possible defect. Current versions and per-advisory links are machine-readable in `evidence/beta-high-triage.json`.

| Prior high entry | Current versions / result | Exposure and decision |
|---|---|---|
| @isaacs/brace-expansion | Package no longer present; no finding | Tooling dependency tree now uses patched brace-expansion versions through existing parent ranges. No native module removed. |
| body-parser | 2.4.0; no finding | Express JSON/urlencoded parsing is a real server input boundary. Patched within parent range. Local integration verifies normal JSON, 413 limit enforcement and rejection of corrupt compressed data. Hosted abuse/rate-limit tests remain open. |
| brace-expansion | 1.1.21, 2.1.7, 5.0.12; no finding | Glob/build/lint tooling. Parent-range updates plus an explicit 1.x-only override patch the remaining old branch without forcing a major API change. |
| decode-uri-component | 0.2.2; **HIGH remains** | Expo Router → query-string decodes URL/query input. Fixed 0.5.1 is ESM-only, whereas query-string 7 uses CommonJS `require`. Do not blindly override it. Native auth intent filtering bounds/discards inputs before forwarding a clean route, but does not certify every router/web/tooling path. Needs a tested upstream backport or compatible router/SDK transition before broader exposure. |
| drizzle-orm | 0.39.3; **HIGH remains** | Server runtime. Advisory requires untrusted SQL identifier/alias construction. Current schema names are static; `server/storage.ts` uses parameterized values and inspected server/shared/scripts paths have no `sql.identifier`, `sql.raw` or dynamic `.as()` calls. No affected identifier-input path was found. Retain as a documented conditional exposure, not a waiver; upgrade to a fixed version in a separate SQL/schema compatibility-tested change. |
| expo-router | 6.0.24; **HIGH inherited** | Inherits the decoder finding. A forced Router 58 replacement would be incompatible with SDK 54. Follow decoder disposition; no separate app exploit was demonstrated. |
| flatted | 3.4.4; no finding | Lint/tool serialization dependency. Compatible update; no application user payload is intentionally passed through this package. |
| http-proxy-middleware | 3.0.10; no finding | Updated within v3. No current source import/use was found in app/server/scripts; not removed solely for that observation. Any future deployed proxy still needs its own configuration/security review. |
| image-size | 1.2.1; **HIGH remains** | Metro's asset inspection tooling imports this parser. Crafted ICNS/JXL/HEIF buffers can hang affected parsers. No patched 1.x exists; fixed version is 2.0.3+, with a changed module/API contract. No app/server user-upload parsing path was identified. Build only reviewed repository assets; prepare a compatible Metro/parser update separately and test malicious fixtures in a bounded worker. |
| js-yaml | 3.15.2, 4.3.2; no finding | Developer configuration/tool parsing. Compatible updates within each installed major; no new app YAML ingestion feature added. |
| minimatch | 3.1.5, 9.0.9, 10.2.6; **MODERATE remains** | High ReDoS advisories are patched within each major. The remaining moderate amplification advisory requires a later major for full removal. Tooling/config glob patterns were inspected; no application endpoint accepts arbitrary glob patterns. Do not label this fully resolved. |
| path-to-regexp | 8.4.2; no finding | Express routing input. Compatible v8 update; local route and parameter behavior remains functional in integration tests. |
| picomatch | 2.3.2, 4.0.7; no finding | Glob/file tooling. Patched within installed majors; no user-configurable runtime glob endpoint found. |
| postcss | 8.5.23; no finding | Expo Metro/web CSS tooling. Targeted override moves beyond Expo's old ~8.4 pin while staying in v8. CSS parse/transform regression and complete web/CSS export pass. Keep this override documented and re-evaluate on SDK upgrades. |
| query-string | 7.1.3; **HIGH inherited** | Inherits decode-uri-component. Keep paired with its CommonJS API until a tested compatible fix; do not claim native intent filtering protects all browser entry points. |
| tmp | 0.2.7; no finding | Temporary-file tooling. Compatible security update; no app API accepts temp prefix/postfix configuration. |
| ws | 6.2.6, 7.5.13, 8.22.1; no finding | Mainly Metro/React Native development tooling in this graph; direct declaration has no current server import. Patched within each parent range; no WebSocket service was started or tested against production. |
| zod | 3.25.76; **HIGH remains** | Advisory concerns excessive error accumulation on oversized collections. No app/server/shared source imports Zod validators; it remains installed for tooling/declared integrations. Express has body-size enforcement, but this does not prove every transitive use is safe. A v4 transition requires coordinated schema/tool compatibility tests; no blind override was applied. |
| zod-validation-error | 3.5.4; **HIGH inherited** | Inherits Zod severity; no current application import found. Do not force its v5 upgrade without the coordinated Zod transition. |

## Why the two overrides are bounded changes

- `brace-expansion@^1.0.0 → 1.1.21` retains the v1 API and addresses the stale nested branch. Other majors resolve through their parents.
- `postcss → 8.5.23` retains the v8 API and addresses the remaining source-map-loading advisories. This intentionally exceeds Expo Metro's old minor pin, so it has explicit parse/transform and bundling evidence. It is not a blanket override of Expo/native libraries.

Remaining seven high entries correspond to four underlying package families (decoder, ORM, image parser and schema validator) plus inherited dependents. Their conditions differ; testing-only exposure is not the same as zero risk. The CI `npm audit --audit-level=high` gate remains unchanged and is expected to fail until the high findings receive fixes or an explicitly approved policy disposition. CI was not pushed or run remotely.

## Validation and next actions

Completed locally: TypeScript, lint, 61 tests, Express parser integration, PostCSS transform, iOS JS export, web/CSS export, SDK check, native config introspection, Expo Doctor 18/18, server compile and expo-asset patch application. No exploit was run against a live service or real data. See TEST_REPORT.md for exact commands and limits.

1. Keep the initial beta on reviewed source/assets and disposable staging accounts. Do not expose Metro or development tooling to untrusted public traffic.
2. Design a decoder backport or compatible SDK/router update; preserve malformed-URL behavior and add bounded adversarial fixtures before enabling broad link/web testing.
3. Prepare the image parser/Metro compatibility update; validate API exports and malformed ICNS/JXL/HEIF handling without allowing tests to hang the main process.
4. Plan Drizzle and Zod transitions with generated-SQL/schema/type/runtime tests and a disposable database where needed. No production schema change is implied by this report.
5. Continue moderate/low triage separately. Do not hide the 52 moderate entries or treat high-count reduction as release certification.

## Primary advisory references

- [Decoder malformed input](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) and [quadratic replacement follow-up](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).
- [Drizzle identifier escaping](https://github.com/advisories/GHSA-gpj5-g38j-94v9): explicitly distinguishes static schemas from untrusted identifier/alias inputs.
- [image-size JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) and [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
- [Zod collection validation](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Every original package's advisory URLs are retained in `evidence/beta-high-triage.json`; final remaining issues, including moderate/low entries and dependency paths, are in `evidence/beta-npm-audit.json`.
