# Security and data model

## Trust boundaries

Every HTTP request is authenticated before database access. `jose` validates an RS256 JWT against the configured Auth0 tenant JWKS, issuer, audience and expiration. The verified subject selects the user; browser-supplied IDs only identify requested resources and confer no authority. Auth0 passwords, refresh tokens and email addresses are not stored by Usfolio. The SDK keeps access tokens in memory.

The Functions handler runs all data operations through `transaction()` and `Service`. The snapshot includes the owner’s own details plus **only shared** details belonging to their current partner. No public invitation-preview endpoint or unfiltered detail/search endpoint exists. Search runs on the already-filtered snapshot. Unknown or inaccessible detail IDs return 404. Enabling partner editing on one profile does not enable it on the other. Partners cannot delete or make details private, even by direct API requests.

The database-access transaction acquires a SQL application lock and uses serializable isolation before loading state or applying permission checks. All writes use SQL parameters. This prevents two concurrent invitation acceptances, partner changes or permission changes from committing an inconsistent state. Permissions are read from SQL for every request, not cached in a JWT. Requests ordered after disconnect or disabling editing see the new permissions. Already-delivered data cannot be recalled from another person's device; the UI refreshes visible collections every 15 seconds and on focus, and clears data if refresh fails. Every write still rechecks server permissions regardless of what an open dialog shows.

Invitations use 192 bits of cryptographic randomness, store only SHA-256 hashes, expire after 24 hours, and are removed on acceptance, replacement, revocation or disconnect. Links carry the token in a URL fragment rather than a query parameter. Possession allows pairing, not unauthenticated profile access. Treat the link as a secret intended for one person. A maximum of one active invitation per owner keeps growth bounded; expired rows are overwritten on the next invitation or removed on account deletion.

## SQL design and scale

Separate tables store profiles, details, partnerships, invitations and deleted-identity hashes. Typed JSON row payloads allow a small migration footprint; computed columns/indexes constrain unique subjects, unique invitation hashes and valid visibility and support future owner-scoped queries. This is a deliberate modest MVP data model, not a normalized analytics schema.

The current repository loads application rows under **one application-wide lock**, evaluates the typed permission rules inside that transaction and persists only changed rows. Database users never connect from the browser. The runtime credential has access only to the application's five tables. This is a simple auditable database-access boundary; it does not claim independent SQL row-level security against a compromised API credential.

This strategy is suitable only for a small early-stage deployment. It serializes requests and grows with the total stored dataset. Before broader use, replace full-state loading with per-profile/partnership SQL queries and row-scoped locking while preserving the same atomic permission checks, and load-test the SQL cold-start and Functions 45-second request limit. Do not increase traffic or quotas without this review. Profiles are limited to 500 details, payload lengths are bounded, and request bodies are capped at 12,000 characters after reading. Function-host concurrency is modest; this is not distributed rate limiting or a WAF.

## Deletion

Account deletion first atomically removes the app profile, owned details, invitations and partnership, disables partner editing on the surviving profile, and anonymizes the deleted creator/editor IDs on details retained by that partner. It keeps a one-way SHA-256 subject hash as a minimal revocation tombstone so already-issued access tokens cannot recreate the account or its data. This is a security retention record, not a profile.

The API then deletes the Auth0 identity through a server-only M2M credential with `delete:users`. If management credentials are absent, deletion fails clearly before changing data. If the external call fails after local deletion, the dialog explains that Usfolio data is already removed and provides retry via the same Delete account action. The request is idempotent. There is no background cleanup worker: if the user closes the app or their token expires before retry, the operator must remove the remaining identity in Auth0. Verify management configuration before public use and handle such support requests promptly. The error does not claim completed provider deletion.

Azure SQL backups and provider audit/security records can outlive live-row deletion according to their configured retention; choose the shortest retention consistent with recovery requirements and document that policy for users. Restoring a backup requires reapplying subsequent deletions before reopening service.

## Browser and operations

Native dialogs supply focus trapping and Escape dismissal. Input/output remain React-escaped; outbound links accept only HTTP(S) and use `noreferrer`. CSP restricts scripts to this app, remote authentication connections to Auth0, framing to the hosted login provider, and denies embedding the app. No analytics, trackers, photo uploads or service worker caches are included. Fonts and illustrations are local assets. The demo persists sample data only and is labeled throughout.

API errors do not log credentials, JWTs, invitation codes or personal detail values. Unexpected failures return a generic message; server logging records the error type only. Protect database backups, deployment tokens and admin accounts, rotate secrets, and review dependency advisories. Never use the SQL migration administrator as the running app's user.
