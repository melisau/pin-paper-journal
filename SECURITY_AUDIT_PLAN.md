# Pin & Paper Security Audit Plan

## Scope and release gate

The audit covers authentication, browser key custody, password recovery, encrypted journal/page payloads, encrypted media, offline drafts, exports, Supabase RLS and Storage policies. A production release is blocked by any unresolved critical/high finding, cross-account access, plaintext journal content leaving the browser, or unrecoverable key-loss path.

## 1. Threat model

Document the protected data, trust boundaries and attackers: a stolen database backup, compromised Storage bucket, malicious authenticated user, shared device, lost device, XSS, intercepted network traffic and accidental operator access. Record explicitly that client compromise while the journal is unlocked is outside what browser-side encryption can fully prevent.

Deliverable: a data-flow diagram and a table mapping each threat to its control and residual risk.

## 2. Automated checks

- Dependency and secret scanning on every pull request.
- Lint, TypeScript build, unit tests, mobile E2E and migration validation in CI.
- Static checks that no service-role key reaches client code.
- Tests confirming operational telemetry contains no journal titles, text, email addresses, IDs, media URLs, encryption material or stack traces.

Deliverable: archived CI result for the release commit.

## 3. Supabase authorization test matrix

Create two disposable users, A and B, in a staging project. For `user_key_bundles`, `journals`, `pages`, `encrypted_assets` and Storage objects, test select/insert/update/delete with both users. User B must receive no rows and no object bytes for every resource owned by A. Repeat with forged journal/page IDs and direct REST/Storage calls, not only through the UI.

Deliverable: request/response evidence with tokens redacted and a signed pass/fail matrix.

## 4. Cryptography and key lifecycle review

- Verify AES-GCM uses a unique 96-bit IV for every encryption.
- Verify PBKDF2 parameters, salts and recovery wrapping.
- Test sign-in, refresh, local key restoration, sign-out clearing, password reset, recovery-code failure and lost-code behavior.
- Confirm Supabase contains only ciphertext for journal metadata, pages, photos and drawings.
- Inspect IndexedDB/localStorage after sign-out; no usable master/journal key or plaintext cloud draft may remain.
- Review object URL revocation and decrypted-media memory lifetime.

Deliverable: independent code-review notes plus reproducible browser/storage inspection steps.

## 5. Application security testing

Test stored/reflected XSS through every editable field and imported backup, malicious file names/MIME types, oversized and decompression-bomb images, CSRF assumptions, open redirects, session fixation, brute-force/rate limits and security headers (CSP, frame-ancestors, nosniff, referrer policy and permissions policy).

Deliverable: findings with severity, reproduction, affected version and remediation owner.

## 6. Resilience and recovery

Exercise interrupted uploads, offline edits, duplicated tabs, stale-device writes, missing encrypted assets, corrupt ciphertext, backup export/import and database restore. Verify failures do not delete the last recoverable copy.

Deliverable: recovery runbook and results from a staging restore drill.

## 7. Privacy-safe observability review

Inspect browser storage, console, network requests and any future monitoring vendor payloads. Only operational event time, scope, status, release and generic error code are permitted. Journal text, title, email, user/journal/page IDs, URLs, file names, ciphertext, keys, recovery codes and stack traces are prohibited.

Deliverable: approved telemetry schema and sample redacted payloads.

## 8. Remediation and sign-off

Track each finding with severity (critical/high/medium/low), owner, fix commit, regression test and retest result. Security sign-off requires zero open critical/high findings, passing cross-account isolation, a successful recovery drill and documented acceptance of remaining medium/low risks.

The audit should be performed against a staging Supabase project by someone other than the primary implementer before production use with sensitive journals.
