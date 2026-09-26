import { beforeEach, describe, expect, it } from "vitest";
import { ApiError, emptyState, Service, hash } from "../api/src/service";
import type { DetailInput } from "../shared/types";
const input: DetailInput = {
  category: "Food & drinks",
  title: "Usual order",
  value: "Oat latte",
  notes: "No syrup",
  link: "",
  visibility: "shared",
  pinned: false,
};
let s: Service, a: string, b: string;
function connect() {
  const { code } = s.invite("alice");
  s.accept("bob", code);
  return code;
}
function error(fn: () => unknown, status: number) {
  try {
    fn();
    throw new Error("Expected rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(status);
  }
}
beforeEach(() => {
  s = new Service(emptyState(), new Date("2026-09-25T12:00:00Z"));
  a = s.me("alice").id;
  b = s.me("bob").id;
});
describe("Profile ownership and shared collections", () => {
  it("starts independent profiles with partner editing disabled", () => {
    expect(s.snapshot("alice").partner).toBeNull();
    expect(s.snapshot("alice").me.allowPartnerEdit).toBe(false);
    expect(s.snapshot("alice").me).not.toHaveProperty("subject");
  });
  it("connects two accounts without exposing content through an invitation", () => {
    s.detail("alice", a, input);
    const { code } = s.invite("alice");
    expect(s.snapshot("bob").details).toEqual([]);
    expect(s.state.invitations[0].hash).toBe(hash(code));
    expect(s.snapshot("alice").invitations[0]).not.toHaveProperty("hash");
    s.accept("bob", code);
    expect(s.snapshot("bob").partner?.id).toBe(a);
    expect(s.snapshot("alice").partner?.id).toBe(b);
    expect(s.snapshot("bob").details[0].value).toBe("Oat latte");
  });
  it("allows each owner to create, update, organize and delete their own details", () => {
    for (const [sub, id] of [
      ["alice", a],
      ["bob", b],
    ]) {
      s.detail(sub, id, input);
      const d = s.state.details.find((d) => d.ownerId === id)!;
      s.detail(
        sub,
        id,
        {
          ...input,
          category: "Favorites",
          title: "Color",
          value: "Green",
          pinned: true,
          visibility: "private",
        },
        d.id,
      );
      expect(s.snapshot(sub).details[0]).toMatchObject({
        category: "Favorites",
        visibility: "private",
        pinned: true,
        value: "Green",
      });
      s.deleteDetail(sub, d.id);
      expect(s.snapshot(sub).details).toEqual([]);
    }
  });
  it("never includes private details in the partner snapshot or search corpus", () => {
    connect();
    s.detail("alice", a, {
      ...input,
      visibility: "private",
      value: "secret allergy",
    });
    s.detail("alice", a, input);
    const partnerData = s.snapshot("bob");
    expect(partnerData.details).toHaveLength(1);
    expect(JSON.stringify(partnerData)).not.toContain("secret allergy");
    const secret = s.state.details[0];
    error(() => s.detail("bob", a, input, secret.id), 404);
    error(() => s.deleteDetail("bob", secret.id), 404);
  });
  it("hides a detail immediately when its owner makes it private", () => {
    connect();
    s.detail("alice", a, input);
    s.detail(
      "alice",
      a,
      { ...input, visibility: "private" },
      s.state.details[0].id,
    );
    expect(s.snapshot("bob").details).toEqual([]);
  });
  it("rejects forged owners, even while other partnerships exist", () => {
    connect();
    s.detail("alice", a, input);
    error(() => s.detail("mallory", a, input), 404);
    error(() => s.detail("mallory", a, input, s.state.details[0].id), 404);
    error(() => s.deleteDetail("mallory", s.state.details[0].id), 404);
    expect(s.snapshot("mallory").details).toEqual([]);
  });
  it("requires independently enabled partner permission on the target profile", () => {
    connect();
    error(() => s.detail("bob", a, input), 403);
    s.profile("alice", { name: "Alice", bio: "", allowPartnerEdit: true });
    s.detail("bob", a, input);
    expect(s.state.details[0]).toMatchObject({
      createdBy: b,
      updatedBy: b,
      ownerId: a,
      visibility: "shared",
    });
    error(() => s.detail("alice", b, input), 403);
  });
  it("removes edit access as soon as editing is disabled", () => {
    connect();
    s.profile("alice", { name: "Alice", bio: "", allowPartnerEdit: true });
    s.detail("bob", a, input);
    const id = s.state.details[0].id;
    s.profile("alice", { name: "Alice", bio: "", allowPartnerEdit: false });
    error(() => s.detail("bob", a, input, id), 403);
    error(() => s.detail("bob", a, input), 403);
    expect(s.snapshot("bob").details).toHaveLength(1);
  });
  it("does not let editors change visibility, delete details, or set owner settings", () => {
    connect();
    s.profile("alice", { name: "Alice", bio: "", allowPartnerEdit: true });
    s.detail("bob", a, input);
    const id = s.state.details[0].id;
    error(
      () => s.detail("bob", a, { ...input, visibility: "private" }, id),
      403,
    );
    error(() => s.deleteDetail("bob", id), 404);
    s.profile("bob", { id: a, name: "Bob", bio: "", allowPartnerEdit: false });
    expect(s.me("alice").allowPartnerEdit).toBe(true);
    s.detail("alice", a, { ...input, value: "Owner revision" }, id);
    expect(s.state.details[0]).toMatchObject({ createdBy: b, updatedBy: a });
    s.deleteDetail("alice", id);
    expect(s.state.details).toEqual([]);
  });
  it("disconnects from either side, retaining owned data and immediately denying former-partner access", () => {
    connect();
    s.profile("alice", { name: "Alice", bio: "", allowPartnerEdit: true });
    s.detail("alice", a, input);
    s.detail("bob", b, input);
    const id = s.state.details[0].id;
    s.disconnect("bob");
    expect(s.snapshot("alice").details.map((d) => d.ownerId)).toEqual([a]);
    expect(s.snapshot("bob").details.map((d) => d.ownerId)).toEqual([b]);
    error(() => s.detail("bob", a, input, id), 404);
    expect(s.me("alice").allowPartnerEdit).toBe(false);
    expect(s.snapshot("alice").partner).toBeNull();
  });
});
describe("Invitation lifecycle", () => {
  it("rejects self-acceptance and guesses", () => {
    const { code } = s.invite("alice");
    error(() => s.accept("alice", code), 400);
    error(() => s.accept("bob", "not-the-code"), 404);
  });
  it("prevents reuse by the same account or a third party", () => {
    const code = connect();
    error(() => s.accept("bob", code), 404);
    error(() => s.accept("charlie", code), 404);
  });
  it("expires at exactly 24 hours", () => {
    const { code } = s.invite("alice");
    s = new Service(s.state, new Date("2026-09-26T12:00:00Z"));
    error(() => s.accept("bob", code), 404);
  });
  it("can be revoked and replacement invalidates the previous link", () => {
    const old = s.invite("alice").code;
    const latest = s.invite("alice").code;
    error(() => s.accept("bob", old), 404);
    s.revoke("alice");
    error(() => s.accept("bob", latest), 404);
  });
  it("allows only one partner for each profile", () => {
    const charlie = s.invite("charlie").code;
    connect();
    error(() => s.accept("bob", charlie), 409);
    error(() => s.invite("alice"), 409);
    expect(s.state.partnerships).toHaveLength(1);
  });
});
describe("Account deletion and validation", () => {
  it("removes associated data, disconnects, anonymizes attribution and blocks old tokens", () => {
    connect();
    s.profile("bob", { name: "Bob", bio: "", allowPartnerEdit: true });
    s.detail("alice", b, input);
    s.detail("alice", a, input);
    s.deleteAccount("alice");
    expect(s.state.profiles.find((p) => p.id === a)).toBeUndefined();
    expect(s.state.partnerships).toEqual([]);
    expect(s.state.details).toHaveLength(1);
    expect(s.state.details[0]).toMatchObject({
      ownerId: b,
      createdBy: "deleted",
      updatedBy: "deleted",
    });
    expect(JSON.stringify(s.state)).not.toContain("alice");
    error(() => s.snapshot("alice"), 410);
    s.deleteAccount("alice");
  });
  it("rejects dangerous links, invalid categories, blank names and invalid boolean values", () => {
    for (const patch of [
      { link: "javascript:alert(1)" },
      { link: "data:text/html,test" },
      { category: "Unknown" },
      { title: "" },
      { visibility: "public" },
      { pinned: "false" },
      { value: "x".repeat(501) },
    ])
      error(() => s.detail("alice", a, { ...input, ...patch }), 400);
    error(
      () => s.profile("alice", { name: "", bio: "", allowPartnerEdit: false }),
      400,
    );
  });
});
