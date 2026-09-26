import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HttpRequest,
  type InvocationContext,
} from "../api/node_modules/@azure/functions";
import { ApiError, Service, emptyState } from "../api/src/service";
import { handler } from "../api/src/index";
const holder = vi.hoisted(() => ({ state: undefined as any }));
vi.mock("../api/src/store", () => ({
  transaction: async (run: (s: Service) => unknown) => {
    const { Service } = await import("../api/src/service");
    const next = structuredClone(holder.state);
    const result = run(new Service(next));
    holder.state = next;
    return result;
  },
}));
vi.mock("../api/src/auth", () => ({
  authenticate: async (header: string | null) => {
    if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Sign in.");
    return header.slice(7);
  },
  deleteIdentity: vi.fn(),
}));
const ctx = { error: vi.fn() } as unknown as InvocationContext;
async function call(
  subject: string | null,
  path = "me",
  method = "GET",
  body?: unknown,
) {
  return handler(
    new HttpRequest({
      method,
      url: `http://localhost/api/${path}`,
      params: { path },
      headers: subject ? { authorization: `Bearer ${subject}` } : {},
      body: body ? { string: JSON.stringify(body) } : undefined,
    }),
    ctx,
  );
}
beforeEach(() => {
  holder.state = emptyState();
});
describe("HTTP API integration with transactional in-memory repository", () => {
  it("requires authentication and ignores browser supplied identity", async () => {
    expect((await call(null)).status).toBe(401);
    const me = (await call("alice")).jsonBody as any;
    await call("alice", "me", "PUT", {
      name: "Alice",
      bio: "",
      allowPartnerEdit: false,
      subject: "bob",
      id: "bob",
    });
    expect((await call("alice")).jsonBody).toMatchObject({
      me: { id: me.me.id, name: "Alice" },
    });
    expect((await call("bob")).jsonBody).toMatchObject({
      me: { name: "Your name" },
    });
  });
  it("exercises two accounts, shared search data, private direct URLs and disconnect", async () => {
    const a = (await call("alice")).jsonBody as any;
    await call("bob");
    const details = {
      ownerId: a.me.id,
      category: "Sizes",
      title: "Shoes",
      value: "US 8",
      notes: "",
      link: "",
      visibility: "shared",
      pinned: true,
    };
    await call("alice", "details", "POST", details);
    await call("alice", "details", "POST", {
      ...details,
      title: "Private note",
      value: "secret",
      visibility: "private",
    });
    const invitation = (await call("alice", "invitations", "POST", {}))
      .jsonBody as any;
    expect(
      (
        await call("bob", "invitations/accept", "POST", {
          code: invitation.code,
        })
      ).status,
    ).toBe(200);
    const visible = (await call("bob")).jsonBody as any;
    expect(visible.details).toHaveLength(1);
    expect(JSON.stringify(visible)).not.toContain("secret");
    const hidden = holder.state.details.find(
      (d: any) => d.visibility === "private",
    );
    expect((await call("bob", `details/${hidden.id}`)).status).toBe(404);
    expect(
      (await call("bob", `details/${hidden.id}`, "PUT", details)).status,
    ).toBe(404);
    expect((await call("bob", "details", "POST", details)).status).toBe(403);
    await call("alice", "me", "PUT", {
      name: "Alice",
      bio: "",
      allowPartnerEdit: true,
    });
    expect((await call("bob", "details", "POST", details)).status).toBe(200);
    expect(
      (await call("bob", `details/${visible.details[0].id}`, "DELETE")).status,
    ).toBe(404);
    expect(
      (
        await call("bob", `details/${visible.details[0].id}`, "PUT", {
          ...details,
          visibility: "private",
        })
      ).status,
    ).toBe(403);
    await call("alice", "me", "PUT", {
      name: "Alice",
      bio: "",
      allowPartnerEdit: false,
    });
    expect((await call("bob", "details", "POST", details)).status).toBe(403);
    await call("alice", "partnership", "DELETE");
    expect(((await call("bob")).jsonBody as any).details).toEqual([]);
    expect((await call("bob", "details", "POST", details)).status).toBe(404);
  });
  it("rolls back invalid writes and returns no-store on errors and successes", async () => {
    await call("alice");
    expect(
      (
        await call("alice", "me", "PUT", {
          name: "Should not persist",
          bio: "",
          allowPartnerEdit: "yes",
        })
      ).status,
    ).toBe(400);
    expect(((await call("alice")).jsonBody as any).me.name).toBe("Your name");
    expect((await call("alice")).headers).toMatchObject({
      "Cache-Control": "no-store",
    });
    expect((await call(null)).headers).toMatchObject({
      "Cache-Control": "no-store",
    });
  });
});
