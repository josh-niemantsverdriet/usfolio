import type { Snapshot, Detail, DetailInput } from "../shared/types";
const key = "usfolio-demo-v1";
const me = {
  id: "alex",
  name: "Alex Morgan",
  bio: "The little things that make my day.",
  allowPartnerEdit: false,
};
const partner = {
  id: "jamie",
  name: "Jamie Parker",
  bio: "A few of my favorite things. And the details worth remembering.",
  allowPartnerEdit: true,
};
const examples: (Partial<DetailInput> &
  Pick<DetailInput, "category" | "title" | "value">)[] = [
  {
    category: "Food & drinks",
    title: "My usual coffee",
    value: "Iced oat milk latte",
    notes: "An extra shot, light ice, no syrup. Always a good idea.",
    pinned: true,
  },
  {
    category: "Sizes",
    title: "Everyday sneakers",
    value: "US 8 · EU 39",
    notes: "Usually a true 8. A half size up for running shoes.",
    pinned: true,
  },
  {
    category: "Favorites",
    title: "Flowers, just because",
    value: "Peonies & ranunculus",
    notes:
      "The peachy, pink, slightly wild kind. A little greenery is lovely too.",
    pinned: true,
  },
  {
    category: "Gift ideas",
    title: "A little everyday bag",
    value: "The Mini Shoulder Bag",
    notes: "In chocolate brown. Small enough for the essentials.",
    link: "https://www.baggu.com/",
  },
  {
    category: "Food & drinks",
    title: "Friday night takeout",
    value: "Pad see ew with tofu",
    notes: "Mild, extra broccoli, no egg. From our favorite Thai place.",
  },
  {
    category: "Sizes",
    title: "The perfect sweater",
    value: "Medium · relaxed fit",
    notes: "Soft cotton or cashmere. Crew necks over V-necks, always.",
  },
  {
    category: "Favorites",
    title: "My kind of weekend",
    value: "Bookshops & a slow morning",
    notes: "A used bookstore, something warm to drink, and no real plans.",
  },
  {
    category: "Gift ideas",
    title: "For the bedside stack",
    value: "A beautiful cookbook",
    notes: "Vegetarian recipes, beautiful photos, and plenty of margin notes.",
  },
  {
    category: "Food & drinks",
    title: "Something sweet",
    value: "Dark chocolate & sea salt",
    notes: "The darker the better. Especially with almonds.",
  },
  {
    category: "Sizes",
    title: "Ring size",
    value: "US 6",
    notes: "Right ring finger. Thin, simple gold bands.",
  },
  {
    category: "Favorites",
    title: "Favorite colors",
    value: "Forest green & terracotta",
    notes: "Earthy, warm, and a little muted.",
  },
  {
    category: "Gift ideas",
    title: "A creative afternoon",
    value: "A pottery class for two",
    notes: "Making something a little imperfect together sounds perfect.",
  },
];
function seed(): Snapshot {
  return {
    me,
    partner,
    invitations: [],
    details: examples
      .map<Detail>((d, i) => ({
        id: `demo-${i}`,
        ownerId: "jamie",
        category: d.category,
        title: d.title,
        value: d.value,
        notes: d.notes || "",
        link: d.link || "",
        pinned: d.pinned || false,
        visibility: "shared",
        createdBy: "jamie",
        updatedBy: "jamie",
        createdAt: "2026-09-01T12:00:00Z",
        updatedAt: "2026-09-20T12:00:00Z",
      }))
      .concat([
        {
          id: "alex-coffee",
          ownerId: "alex",
          category: "Food & drinks",
          title: "Coffee, please",
          value: "Flat white",
          notes: "Whole milk, no sugar.",
          link: "",
          pinned: true,
          visibility: "shared",
          createdBy: "alex",
          updatedBy: "alex",
          createdAt: "2026-09-01T12:00:00Z",
          updatedAt: "2026-09-20T12:00:00Z",
        },
        {
          id: "alex-private",
          ownerId: "alex",
          category: "Gift ideas",
          title: "A note to myself",
          value: "Try watercolor painting",
          notes: "Just for me, for now.",
          link: "",
          pinned: false,
          visibility: "private",
          createdBy: "alex",
          updatedBy: "alex",
          createdAt: "2026-09-01T12:00:00Z",
          updatedAt: "2026-09-20T12:00:00Z",
        },
      ]),
  };
}
export async function demoRequest(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
): Promise<any> {
  let state: Snapshot;
  try {
    state = JSON.parse(localStorage.getItem(key) || "null") || seed();
  } catch {
    state = seed();
  }
  if (method === "GET") return state;
  if (path === "me" && method === "PUT") Object.assign(state.me, body);
  else if (path === "me" && method === "DELETE") {
    localStorage.removeItem(key);
    return { deleted: true };
  } else if (path === "partnership") {
    state.partner = null;
    state.details = state.details.filter((d) => d.ownerId === state.me.id);
    state.me.allowPartnerEdit = false;
  } else if (path === "invitations" && method === "POST") {
    const code = crypto.randomUUID();
    state.invitations = [
      {
        id: code,
        ownerId: state.me.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ];
    localStorage.setItem(key, JSON.stringify(state));
    return { code };
  } else if (path === "invitations" && method === "DELETE")
    state.invitations = [];
  else if (path === "invitations/accept")
    throw new Error(
      "Demo invitations cannot connect real accounts. Configure sign-in to invite your partner.",
    );
  else if (path.startsWith("details")) {
    const id = path.split("/")[1],
      existing = state.details.find((d) => d.id === id);
    if (method === "DELETE") {
      if (existing?.ownerId !== state.me.id)
        throw new Error("Only the owner can delete a detail.");
      state.details = state.details.filter((d) => d.id !== id);
    } else {
      const own = body?.ownerId === state.me.id;
      if (
        !own &&
        (!state.partner?.allowPartnerEdit ||
          body?.ownerId !== state.partner.id ||
          body?.visibility !== "shared" ||
          existing?.visibility === "private")
      )
        throw new Error("This detail cannot be edited.");
      const data = {
        ...body,
        updatedBy: state.me.id,
        updatedAt: new Date().toISOString(),
      };
      if (existing) Object.assign(existing, data);
      else
        state.details.push({
          ...data,
          id: crypto.randomUUID(),
          createdBy: state.me.id,
          createdAt: new Date().toISOString(),
        } as Detail);
    }
  }
  localStorage.setItem(key, JSON.stringify(state));
  return state;
}
