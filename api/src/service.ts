import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  categories,
  type State,
  type Snapshot,
  type Profile,
  type DetailInput,
} from "../../shared/types.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const emptyState = (): State => ({
  profiles: [],
  details: [],
  partnerships: [],
  invitations: [],
  deleted: [],
});
function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}
function text(value: unknown, max: number, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(
      400,
      `Enter ${required ? "a value with " : ""}no more than ${max} characters.`,
    );
  return value.trim();
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean")
    fail(400, "Expected a true or false setting.");
  return value;
}
export function validateDetail(input: Record<string, unknown>): DetailInput {
  if (!categories.includes(input.category as never))
    fail(400, "Choose a category.");
  if (input.visibility !== "shared" && input.visibility !== "private")
    fail(400, "Choose shared or private.");
  const link = text(input.link, 2048);
  if (link) {
    try {
      if (!["https:", "http:"].includes(new URL(link).protocol))
        fail(400, "Use an http or https link.");
    } catch {
      fail(400, "Enter a valid website link.");
    }
  }
  return {
    category: input.category as DetailInput["category"],
    title: text(input.title, 100, true),
    value: text(input.value, 500, true),
    notes: text(input.notes, 2000),
    link,
    visibility: input.visibility,
    pinned: bool(input.pinned),
  };
}

// Every service call is executed inside the repository's locked SQL transaction.
// Identity comes exclusively from a verified access token, never request JSON.
export class Service {
  constructor(
    public state: State,
    private now = new Date(),
  ) {}
  me(subject: string): Profile {
    if (this.state.deleted.includes(hash(subject)))
      fail(410, "This account has been deleted.");
    let me = this.state.profiles.find((p) => p.subject === subject);
    if (!me) {
      me = {
        id: randomUUID(),
        subject,
        name: "Your name",
        bio: "",
        allowPartnerEdit: false,
      };
      this.state.profiles.push(me);
    }
    return me;
  }
  partner(id: string) {
    const pair = this.state.partnerships.find((p) => p.a === id || p.b === id);
    return pair
      ? this.state.profiles.find(
          (p) => p.id === (pair.a === id ? pair.b : pair.a),
        )
      : undefined;
  }
  snapshot(subject: string): Snapshot {
    const me = this.me(subject),
      partner = this.partner(me.id);
    const publicProfile = ({ subject: _subject, ...profile }: Profile) =>
      profile;
    return {
      me: publicProfile(me),
      partner: partner ? publicProfile(partner) : null,
      details: this.state.details.filter(
        (d) =>
          d.ownerId === me.id ||
          (d.ownerId === partner?.id && d.visibility === "shared"),
      ),
      invitations: this.state.invitations
        .filter(
          (i) => i.ownerId === me.id && i.expiresAt > this.now.toISOString(),
        )
        .map(({ hash: _hash, ...i }) => i),
    };
  }
  profile(subject: string, input: Record<string, unknown>) {
    const me = this.me(subject);
    me.name = text(input.name, 60, true);
    me.bio = text(input.bio, 160);
    me.allowPartnerEdit = bool(input.allowPartnerEdit);
  }
  detail(
    subject: string,
    ownerId: string,
    input: Record<string, unknown>,
    id?: string,
  ) {
    const me = this.me(subject),
      owner = this.state.profiles.find((p) => p.id === ownerId);
    const existing = id
      ? this.state.details.find((d) => d.id === id && d.ownerId === ownerId)
      : undefined;
    const own = me.id === ownerId;
    if (
      !owner ||
      (id && !existing) ||
      (!own &&
        (this.partner(me.id)?.id !== ownerId ||
          existing?.visibility === "private"))
    )
      fail(404, "Detail not found.");
    if (!own && !owner.allowPartnerEdit)
      fail(403, "Your partner has not enabled editing.");
    const data = validateDetail(input);
    if (!own && data.visibility !== "shared")
      fail(403, "Only the owner can change visibility.");
    const time = this.now.toISOString();
    if (existing)
      Object.assign(existing, data, { updatedBy: me.id, updatedAt: time });
    else {
      if (this.state.details.filter((d) => d.ownerId === ownerId).length >= 500)
        fail(409, "This collection is full (500 details).");
      this.state.details.push({
        ...data,
        id: randomUUID(),
        ownerId,
        createdBy: me.id,
        updatedBy: me.id,
        createdAt: time,
        updatedAt: time,
      });
    }
  }
  deleteDetail(subject: string, id: string) {
    const me = this.me(subject),
      detail = this.state.details.find((d) => d.id === id);
    if (!detail || detail.ownerId !== me.id) fail(404, "Detail not found.");
    this.state.details = this.state.details.filter((d) => d.id !== id);
  }
  invite(subject: string) {
    const me = this.me(subject);
    if (this.partner(me.id))
      fail(409, "Disconnect before inviting a new partner.");
    this.state.invitations = this.state.invitations.filter(
      (i) => i.ownerId !== me.id,
    );
    const code = randomBytes(24).toString("base64url");
    this.state.invitations.push({
      id: randomUUID(),
      ownerId: me.id,
      hash: hash(code),
      createdAt: this.now.toISOString(),
      expiresAt: new Date(+this.now + 86400000).toISOString(),
    });
    return { code };
  }
  revoke(subject: string) {
    const me = this.me(subject);
    this.state.invitations = this.state.invitations.filter(
      (i) => i.ownerId !== me.id,
    );
  }
  accept(subject: string, code: unknown) {
    const me = this.me(subject);
    const token = text(code, 100, true);
    const invite = this.state.invitations.find(
      (i) => i.hash === hash(token) && i.expiresAt > this.now.toISOString(),
    );
    if (!invite)
      fail(
        404,
        "This invitation has expired, was revoked, or has already been used.",
      );
    if (invite.ownerId === me.id)
      fail(400, "Ask your partner to open this invitation in their account.");
    if (this.partner(me.id) || this.partner(invite.ownerId))
      fail(409, "One of you is already connected to a partner.");
    this.state.partnerships.push({
      id: randomUUID(),
      a: invite.ownerId,
      b: me.id,
    });
    this.state.invitations = this.state.invitations.filter(
      (i) => i.ownerId !== me.id && i.ownerId !== invite.ownerId,
    );
  }
  disconnect(subject: string) {
    const me = this.me(subject),
      partner = this.partner(me.id);
    this.state.partnerships = this.state.partnerships.filter(
      (p) => p.a !== me.id && p.b !== me.id,
    );
    me.allowPartnerEdit = false;
    if (partner) partner.allowPartnerEdit = false;
    this.state.invitations = this.state.invitations.filter(
      (i) => i.ownerId !== me.id && i.ownerId !== partner?.id,
    );
  }
  deleteAccount(subject: string) {
    if (this.state.deleted.includes(hash(subject))) return;
    const me = this.me(subject);
    this.disconnect(subject);
    this.state.details = this.state.details.filter((d) => d.ownerId !== me.id);
    // Remove identifying attribution from details kept by the former partner.
    for (const d of this.state.details) {
      if (d.createdBy === me.id) d.createdBy = "deleted";
      if (d.updatedBy === me.id) d.updatedBy = "deleted";
    }
    this.state.profiles = this.state.profiles.filter((p) => p.id !== me.id);
    this.state.deleted.push(hash(subject));
  }
}
