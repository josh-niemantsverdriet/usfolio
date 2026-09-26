# Setup and Azure deployment

Nothing in this repository automatically creates Azure resources. Review the code and costs first. Creating resources and running the manual deployment workflow are actions for the subscription owner after explicit approval.

## 1. Configure Auth0

1. Create an Auth0 tenant and a **Single Page Application** called Usfolio. Use Universal Login and enable an Auth0 database email/password connection with signup and password reset. No social account is required. Enable the provider's available attack protection and email verification. Do not store passwords in Usfolio.
2. Register an API with identifier `https://usfolio-api` and **RS256** signing. Use this exact audience everywhere. Set a short access-token lifetime, for example 15 minutes. Disable offline access unless you intentionally configure refresh-token rotation; this MVP uses SDK memory caching.
3. In the SPA, allow `http://localhost:5173` as callback URL, logout URL and web origin. Add the eventual exact `https://<site>.azurestaticapps.net` URL for each setting. Do not use wildcard callbacks.
4. For account deletion, create a **Machine to Machine** application authorized for the Auth0 Management API with **only `delete:users`**. Keep its secret server-side. This application is not the SPA.
5. Before public use, configure an Auth0 production email provider and verify its sender/domain for verification and password-reset mail. Built-in Auth0 test email is not a production delivery service. The provider may charge separately.

## 2. Local full-stack development

Install Node.js 22, npm, Azure Functions Core Tools v4 and a SQL Server instance with TCP enabled (SQL Server Developer/Express locally, or an already authorized Azure SQL database). The migration is also compatible with LocalDB, but the Node `mssql` runtime configuration expects a TCP SQL endpoint with SQL authentication. Do not point development at another application's database.

```powershell
npm ci
npm ci --prefix api
Copy-Item .env.example .env
Copy-Item .env.server.example .env.server
Copy-Item api/local.settings.example.json api/local.settings.json
```

Populate the files privately. `.env` contains only public Auth0 SPA configuration. `.env.server` is used by the migration command; it should use a database owner/migration credential. `api/local.settings.json` contains runtime settings and should use a separate restricted database user.

Create an empty database named `usfolio` on your local SQL Server, then:

```powershell
npm --prefix api run migrate
npm --prefix api run build
# Terminal 1:
Set-Location api
func start
# Terminal 2, from the repository root:
npm run dev
```

Vite proxies `/api` to port 7071. Auth0 returns to port 5173. The API verifies real tokens even locally; there is no development impersonation header. HTTP-only Functions do not need Blob Storage or file uploads. A populated local settings file is never committed.

The migration runner applies `001_initial.sql` once under a migration lock, records version 1 in `dbo.SchemaMigrations`, and is safe to rerun. It rolls back on error. Later changes should be new numbered migrations with matching runner updates, never edits to a migration already deployed. Back up before changing a populated database.

## 3. Environment variables

| Variable                          | Where                                    | Purpose                                                             |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `VITE_AUTH0_DOMAIN`               | Frontend build / `.env`                  | Tenant hostname, without scheme or slash                            |
| `VITE_AUTH0_CLIENT_ID`            | Frontend build / `.env`                  | Public SPA client ID                                                |
| `VITE_AUTH0_AUDIENCE`             | Frontend build / `.env`                  | Registered API identifier                                           |
| `AUTH0_DOMAIN`                    | API settings                             | Same tenant hostname                                                |
| `AUTH0_AUDIENCE`                  | API settings                             | Same API identifier                                                 |
| `AUTH0_MANAGEMENT_CLIENT_ID`      | API settings                             | Management M2M client ID                                            |
| `AUTH0_MANAGEMENT_CLIENT_SECRET`  | API secret setting                       | Management M2M secret, `delete:users` only                          |
| `SQL_SERVER`                      | API and migration environment            | SQL server hostname                                                 |
| `SQL_DATABASE`                    | API and migration environment            | Database name                                                       |
| `SQL_USER`                        | API and migration environment            | Separate runtime / migration credentials                            |
| `SQL_PASSWORD`                    | API and migration secret settings        | SQL credential; never a Vite variable                               |
| `SQL_TRUST_CERTIFICATE`           | Local SQL only                           | `true` for local self-signed certificates; omit or `false` in Azure |
| `FUNCTIONS_WORKER_RUNTIME`        | Local Functions settings                 | `node`                                                              |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | GitHub **production environment secret** | SWA deployment token, never frontend config                         |

Use Azure Static Web Apps **Settings → Environment variables** for API values. Use a GitHub `production` environment with the three public `VITE_*` variables and deployment token secret. Restrict access to these settings and rotate SQL/M2M/deployment secrets if exposed. Do not put secrets in frontend environment variables, workflow source or SQL files.

## 4. Prepare Azure resources after review

1. Select the correct subscription and region. Create a dedicated resource group only after authorizing resource creation.
2. Create **Azure Static Web Apps, Free**, without an App Service plan or a separately linked Function App. Use its **managed Functions** API. Choose deployment source **Other** if creating through the portal to avoid a generated automatic deployment workflow. The repository's workflow is manually triggered.
3. Create an Azure SQL logical server and one **General Purpose serverless free-offer database**, if your subscription is eligible. Explicitly select the free offer and **auto-pause until next month when the free allowance is exhausted**, rather than continuing at paid rates. Set a modest maximum size and shortest suitable auto-pause delay. If that offer is unavailable, stop and review the SQL price estimate before proceeding.
4. Configure encrypted SQL access. Permit the administrator's IP temporarily to run the migration. Managed SWA Functions do not provide a private-network-isolated backend. If enabling **Allow Azure services and resources to access this server** is needed for the managed API, understand that it widens network reach to Azure, while SQL credentials still control data access. A requirement for private networking calls for a different, potentially paid architecture.
5. Set migration credentials in an uncommitted `.env.server` and run `npm --prefix api run migrate` from your workstation. Then remove temporary administrator firewall access if no longer needed.
6. Create a contained runtime SQL user using your SQL administrator, assigning a unique strong password through your SQL administration tool. Grant **SELECT, INSERT, UPDATE, DELETE only on the five application tables**: `Profiles`, `Details`, `Partnerships`, `Invitations`, `DeletedIdentities`. Do not grant DDL, database owner or access to other applications. `SchemaMigrations` need not be accessible to the runtime. The runtime also calls `sys.sp_getapplock` (available to database users with the default public database principal).
7. Set the API environment variables on SWA. Set `SQL_TRUST_CERTIFICATE=false`. Never use the administrator's SQL credentials as runtime credentials.
8. Add the SWA URL to Auth0 callback/logout/web-origin allowlists. The bundled CSP allows standard `*.auth0.com` tenant hosts. If using a custom Auth0 domain, update `connect-src` and `frame-src` to that exact HTTPS domain before building.
9. Configure the GitHub `production` environment variables/secret described above. Recommended: require a reviewer for the environment. Run CI, then manually run **Deploy Usfolio (manual)**. This is the step that publishes the app.

The workflow builds the frontend to `dist/`, compiles the API to `api/dist/`, retains API production dependencies, and uploads both with build skipping enabled. The API entry is `dist/api/src/index.js` relative to the `api/` directory. The shared compiled types live under `api/dist/shared/`. SWA routes `/api/*` to Functions and everything else to the SPA except static assets. APIs always return `Cache-Control: no-store` and never fall back to HTML.

Do not enable SWA's `authenticated` route role for these endpoints: it represents SWA platform sessions, not the app's Auth0 bearer tokens. Token verification in every Functions request is the authentication boundary.

## 5. Required two-account acceptance check

Use two real Auth0 accounts in separate browser profiles, connected to a development database:

1. Sign up, complete names, and save one private and one shared detail each.
2. Create/copy an invitation, sign in as the other account and accept. Confirm reuse and a revoked invitation fail.
3. Search each partner collection. Check private values are absent from the `/api/me` network response and cannot be accessed by detail ID.
4. Enable editing on only one account. The other can add/edit shared details, but cannot change visibility, delete, or access private entries. Confirm attribution.
5. Turn editing off and replay a former edit request: it must fail. Disconnect and request again: partner data must be absent immediately at the API.
6. Reconnect and test deletion with a throwaway account. Ensure the profile and owned rows disappear, the surviving profile stays, and the Auth0 identity is removed. A stale deleted-account access token must receive 410.
7. Test password recovery email, sign-out, mobile layout, expired sessions, and API/database failure feedback.

## Cost expectations

Official documentation checked **September 25, 2026**. Prices depend on region, currency, account agreement and eligibility; recheck before authorizing. No paid resources were created for this implementation.

| Service                                             | Early-stage allowance / estimate                                                                                                                             | Potential charges                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SWA Free + managed HTTP Functions                   | $0 hosting within quotas; managed APIs are included in all plans. Included bandwidth is 100 GB/month per the quotas page. No separate Function App required. | Standard has a recurring per-app charge; extra features, larger hosting requirements or bandwidth needs require review. Free has no production SLA.               |
| Azure SQL free offer                                | If eligible: 100,000 vCore-seconds, 32 GB data and 32 GB backup per database/month. Choose pause-at-limit for a $0 database compute path.                    | Paid continuation after allowance, non-free SKU selection, additional storage/backup/replication options. SQL is the most likely source of cost if misconfigured. |
| Auth0 Free                                          | $0 within the advertised 25,000 monthly active users and included feature limits.                                                                            | Paid features/upgrades and management API usage beyond included limits. Deletion obtains an M2M token per request; Free advertises 1,000 M2M authentications.     |
| Email delivery                                      | Provider-specific; no email vendor provisioned by this project.                                                                                              | Production verification and password-reset delivery may incur per-message or monthly costs.                                                                       |
| GitHub Actions, custom domain, optional diagnostics | Depends on repository/account plan; use included build minutes where available.                                                                              | Private-repo build overages, domain registration and optional Azure monitoring/log retention.                                                                     |
| Blob Storage                                        | Not used.                                                                                                                                                    | No application file-storage resources required.                                                                                                                   |

A very small deployment can fit the hosting/auth/database free allowances, but a universal $0 total cannot be promised, especially with production email. Frequent activity and the MVP's transaction strategy can consume SQL compute; background refresh only runs while the page is visible. Use Azure budgets/alerts and monitor the SQL allowance. Budget alerts alone do not stop charges.

Official sources: [SWA pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/), [SWA quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas), [managed API plan requirements](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview), [Azure SQL free offer and limit behavior](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer?view=azuresql), [Auth0 pricing](https://auth0.com/pricing), [Auth0 email-provider guidance](https://support.auth0.com/center/s/article/Emails-to-Gmail-from-Auth0-never-arrive).

Your remaining actions are to review this implementation, configure Auth0 and production email, approve any Azure resource costs, supply secrets privately, run the migration and live two-account acceptance check, then explicitly initiate deployment.
