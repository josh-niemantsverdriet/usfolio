import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "./service.js";
let keys: ReturnType<typeof createRemoteJWKSet>;
export async function authenticate(
  authorization: string | null,
): Promise<string> {
  if (!authorization?.startsWith("Bearer "))
    throw new ApiError(401, "Please sign in to continue.");
  const domain = process.env.AUTH0_DOMAIN,
    audience = process.env.AUTH0_AUDIENCE;
  if (!domain || !audience)
    throw new Error("Authentication configuration is missing.");
  keys ??= createRemoteJWKSet(
    new URL(`https://${domain}/.well-known/jwks.json`),
  );
  try {
    const { payload } = await jwtVerify(authorization.slice(7), keys, {
      issuer: `https://${domain}/`,
      audience,
      algorithms: ["RS256"],
    });
    if (!payload.sub || !payload.exp) throw new Error();
    return payload.sub;
  } catch {
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
}
export async function deleteIdentity(subject: string) {
  const domain = process.env.AUTH0_DOMAIN,
    client_id = process.env.AUTH0_MANAGEMENT_CLIENT_ID,
    client_secret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
  if (!client_id || !client_secret)
    throw new Error("Account deletion is not configured.");
  const token = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id,
      client_secret,
      audience: `https://${domain}/api/v2/`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!token.ok) throw new Error("Identity service is unavailable.");
  const { access_token } = (await token.json()) as { access_token: string };
  const response = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(subject)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok && response.status !== 404)
    throw new Error("Identity deletion failed.");
}
