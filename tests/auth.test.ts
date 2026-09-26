import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../api/src/auth";
import { createRemoteJWKSet, jwtVerify } from "../api/node_modules/jose";
vi.mock("../api/node_modules/jose", () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("Bearer authentication boundary", () => {
  it("rejects missing and non-bearer headers", async () => {
    await expect(authenticate(null)).rejects.toMatchObject({ status: 401 });
    await expect(authenticate("Basic alice")).rejects.toMatchObject({
      status: 401,
    });
  });
  it("fails closed without provider configuration", async () => {
    vi.stubEnv("AUTH0_DOMAIN", "");
    vi.stubEnv("AUTH0_AUDIENCE", "");
    await expect(authenticate("Bearer token")).rejects.toThrow("configuration");
  });
  it("uses the configured issuer, audience and RS256, and takes identity from the verified subject", async () => {
    vi.stubEnv("AUTH0_DOMAIN", "tenant.auth0.com");
    vi.stubEnv("AUTH0_AUDIENCE", "https://usfolio-api");
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: "auth0|alice", exp: 9999999999 },
    } as never);
    expect(await authenticate("Bearer valid-token")).toBe("auth0|alice");
    expect(jwtVerify).toHaveBeenCalledWith("valid-token", expect.anything(), {
      issuer: "https://tenant.auth0.com/",
      audience: "https://usfolio-api",
      algorithms: ["RS256"],
    });
  });
  it("denies invalid signatures, expired tokens, and tokens without subject or expiration", async () => {
    vi.stubEnv("AUTH0_DOMAIN", "tenant.auth0.com");
    vi.stubEnv("AUTH0_AUDIENCE", "https://usfolio-api");
    vi.mocked(jwtVerify).mockRejectedValue(new Error("invalid"));
    await expect(authenticate("Bearer forged")).rejects.toMatchObject({
      status: 401,
    });
    for (const payload of [{ sub: "alice" }, { exp: 9999999999 }]) {
      vi.mocked(jwtVerify).mockResolvedValue({ payload } as never);
      await expect(authenticate("Bearer incomplete")).rejects.toMatchObject({
        status: 401,
      });
    }
  });
});
