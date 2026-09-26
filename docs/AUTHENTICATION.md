# Authentication decision

Reviewed against official documentation on **September 25, 2026**, before implementation.

| Option                                                        | User experience                                    | SWA plan / cost                                                              | Security and local development                                                                                                                            | Decision                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| SWA preconfigured providers                                   | GitHub or Microsoft account                        | Included in Free                                                             | Platform-managed session; local SWA emulator does not constitute real identity verification                                                               | Does not meet ordinary-user email signup requirement                           |
| SWA custom OIDC with Auth0 or Entra                           | Hosted email signup                                | SWA **Standard** required, plus provider terms                               | Platform owns the session; emulator useful locally, hosted provider still needs configuration                                                             | Viable, but adds a paid hosting requirement                                    |
| Auth0 React SDK + API JWT validation                          | Hosted email/password, signup and password reset   | SWA Free with managed Functions; Auth0 Free advertises up to **25,000 MAU**  | Authorization Code + PKCE, SDK in-memory tokens, hosted password handling, issuer/audience/signature/expiry checks in API; real tenant supports localhost | **Chosen**: small integration, mature SDK, no paid SWA custom-auth requirement |
| Entra External ID external tenant + MSAL + API JWT validation | Consumer email/password or email one-time passcode | SWA Free with app-level auth; core External ID includes first **50,000 MAU** | Managed identity and token security; localhost callbacks possible; external tenant, user flow, app and API registration setup required                    | Good Azure-native alternative; more tenant/user-flow setup for this MVP        |

The cost comparison is an architectural assessment, not a guarantee of a zero bill. SMTP delivery, usage above free quotas and optional provider features may cost money. The chosen hosted email/password connection minimizes email delivery on each login while allowing ordinary email signup. Production verification and recovery emails still require a suitable email provider. There is no homegrown password database, local identity header, or fake API authentication mode.

Implementation uses `@auth0/auth0-react` with memory token caching and no persistent access tokens. The API uses `jose` with a fixed configured JWKS URL, RS256 only, exact issuer and audience, a required subject and expiry. It ignores SWA principal headers and user IDs in JSON as identity evidence. No browser client secret is used.

Use Auth0's standard tenant domain for the MVP. Custom domains require additional provider configuration and an update to the app's CSP allowlist. Registration creates an app profile with partner editing disabled and opens the profile form. No email address is copied into Azure SQL.

Official sources:

- [SWA custom authentication requires Standard](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom).
- [SWA managed Functions are included in all plans; bring-your-own APIs require Standard](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview).
- [Auth0 React SDK setup](https://auth0.com/docs/quickstart/spa/react) and [Authorization Code with PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce/add-login-using-the-authorization-code-flow-with-pkce).
- [Auth0 Free plan and included authentication features](https://auth0.com/pricing).
- [Microsoft Entra External ID pricing](https://www.microsoft.com/en-us/security/pricing/microsoft-entra-external-id/).
- [Auth0 production email-provider guidance](https://support.auth0.com/center/s/article/Emails-to-Gmail-from-Auth0-never-arrive).
