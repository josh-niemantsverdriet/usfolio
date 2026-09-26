import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { transaction, closeStore } from "../dist/api/src/store.js";
import { hash } from "../dist/api/src/service.js";
const run = randomUUID(),
  alice = `usfolio-smoke:${run}:a`,
  bob = `usfolio-smoke:${run}:b`;
const input = {
  category: "Sizes",
  title: "SQL smoke test",
  value: "US 8",
  notes: "",
  link: "",
  visibility: "shared",
  pinned: false,
};
try {
  const a = await transaction((s) => s.me(alice).id);
  await transaction((s) => s.me(bob));
  await transaction((s) => s.detail(alice, a, input));
  await transaction((s) =>
    s.detail(alice, a, {
      ...input,
      value: "private test value",
      visibility: "private",
    }),
  );
  const { code } = await transaction((s) => s.invite(alice));
  await transaction((s) => s.accept(bob, code));
  let snapshot = await transaction((s) => s.snapshot(bob));
  assert.equal(snapshot.details.length, 1);
  assert.equal(snapshot.details[0].visibility, "shared");
  await assert.rejects(
    transaction((s) => s.detail(bob, a, input)),
    { status: 403 },
  );
  await transaction((s) =>
    s.profile(alice, {
      name: "SQL smoke test",
      bio: "",
      allowPartnerEdit: true,
    }),
  );
  const id = snapshot.details[0].id;
  await transaction((s) => s.detail(bob, a, { ...input, value: "US 9" }, id));
  await assert.rejects(
    transaction((s) =>
      s.detail(bob, a, { ...input, visibility: "private" }, id),
    ),
    { status: 403 },
  );
  await assert.rejects(
    transaction((s) => s.deleteDetail(bob, id)),
    { status: 404 },
  );
  await transaction((s) =>
    s.profile(alice, {
      name: "SQL smoke test",
      bio: "",
      allowPartnerEdit: false,
    }),
  );
  await assert.rejects(
    transaction((s) => s.detail(bob, a, input, id)),
    { status: 403 },
  );
  await transaction((s) => s.disconnect(alice));
  snapshot = await transaction((s) => s.snapshot(bob));
  assert.equal(snapshot.partner, null);
  assert.equal(snapshot.details.length, 0);
  console.log(
    "Live SQL passed: connection, private filtering, partner editing, owner-only changes, immediate revocation and disconnect.",
  );
} finally {
  await transaction((s) => {
    s.deleteAccount(alice);
    s.deleteAccount(bob);
    s.state.deleted = s.state.deleted.filter(
      (value) => value !== hash(alice) && value !== hash(bob),
    );
  });
  console.log(
    "Removed the two isolated SQL test profiles and all their test data.",
  );
  await closeStore();
}
