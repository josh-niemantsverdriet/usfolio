# Usfolio

A warm, mobile-first collection of the little details two people want to remember. React + TypeScript, Azure Functions, Azure SQL, and Auth0 email sign-in. No cloud resources have been created or deployed.

## Try it locally

Use Node.js 22 and npm 10 or newer:

```sh
npm ci
npm ci --prefix api
npm run dev
```

Open **http://localhost:5173**. Without Auth0 environment variables, Usfolio opens a **clearly labeled browser demo** as Alex, viewing Jamie's sample collection. Search, category filters, quick picks, adding/editing/deleting details, privacy, settings, and disconnect all work in the demo. Changes persist in local storage. Reset it in profile settings. Demo invitations deliberately cannot connect accounts; this mode is isolated from the API and is not authentication.

For real accounts and durable data, follow [the setup and deployment guide](docs/DEPLOYMENT.md). That guide covers the Auth0 tenant, local API, database migration, required variables, Azure configuration, costs, and the manual deployment workflow.

## What is included

- Own and partner collections; sizes, food/drinks, favorites, and openly shared gift ideas.
- Flexible titles, values, notes, optional links, category organization and quick picks. Sizes, colors, brands, restaurant orders, substitutions and allergies can be recorded without a questionnaire.
- Search over **only the server-authorized** details, with category, recent and alphabetical organization.
- Per-detail private/shared settings; partner editing independently off by default on real profiles.
- Single-use, 24-hour invitations; replacing or revoking a link invalidates it.
- Creator/editor attribution, independent sharing settings, disconnect, and account deletion.
- Hosted email/password signup and login. Auth0 handles password storage, recovery, session security and attack protection.
- Server-side JWT verification, permission checks, transactional SQL persistence, migrations, and manual Azure deployment configuration.
- Responsive navigation, keyboard-accessible dialogs, focus indicators, loading/error/success states, locally hosted fonts and no analytics.

## Authentication decision

Chosen: **Auth0 Universal Login with an email/password database connection**, Authorization Code + PKCE through its maintained React SDK, and RS256 access-token verification in the Functions API. Ordinary users need only an email address. Usfolio never receives a password. The [decision record](docs/AUTHENTICATION.md) compares Auth0, Microsoft Entra External ID, and SWA built-in/custom authentication against plan, cost, security and local-development requirements.

This uses an application-level bearer token. It does **not** use SWA's paid custom-authentication feature. Every API route performs its own token verification; `authLevel: anonymous` is required for browser requests and is not an authorization bypass.

## Verification

```sh
npm run check                  # frontend build, service/auth/HTTP tests, API build
npx playwright install chromium
npm run test:e2e               # desktop/mobile workflows and automated accessibility
```

The tests cover both profiles, invitation connection/expiry/revocation/reuse, private data exclusion and direct requests, independent partner-edit permissions, owner-only visibility/deletion, immediate server-side disconnect/revocation, account deletion, validation and rollback. HTTP tests exercise the real handler and service with an in-memory transactional repository; JWT tests verify the required issuer/audience/algorithm contract. Browser tests use the explicitly isolated demo.

On Windows with SQL Server LocalDB and `sqlcmd`, validate migration DDL in a rolled-back `tempdb` transaction:

```powershell
SqlLocalDB start MSSQLLocalDB
SqlLocalDB info MSSQLLocalDB
# Pass the "Instance pipe name" printed above:
./scripts/verify-migration.ps1 -Server 'np:\\.\pipe\YOUR-LOCALDB-PIPE\tsql\query'
```

Real Auth0 round trips and Azure SQL/Functions deployment require your accounts and configuration; those cloud integration checks cannot be completed in the unconfigured local demo. Before inviting real users, run the two-account acceptance checklist in the deployment guide.

## Project map

| Path                              | Purpose                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `src/`                            | React app, styles and isolated demo adapter                        |
| `shared/types.ts`                 | Profile, detail and invitation types                               |
| `api/src/service.ts`              | Validation and permission rules                                    |
| `api/src/store.ts`                | Locked SQL transactions and parameterized persistence              |
| `api/src/auth.ts`                 | JWT validation and Auth0 identity deletion                         |
| `api/migrations/`                 | Versioned database schema                                          |
| `tests/`, `e2e/`                  | Permission, authentication, HTTP, browser and accessibility checks |
| `public/staticwebapp.config.json` | SPA routing, Node runtime and security headers                     |
| `.github/workflows/`              | CI verification and explicitly manual deployment                   |

Read [security and data notes](docs/SECURITY.md) for the deliberate early-stage persistence tradeoffs, deletion behavior and operational limits.
