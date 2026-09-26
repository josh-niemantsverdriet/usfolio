export const categories = [
  "Sizes",
  "Food & drinks",
  "Favorites",
  "Gift ideas",
] as const;
export type Category = (typeof categories)[number];
export type Profile = {
  id: string;
  subject: string;
  name: string;
  bio: string;
  allowPartnerEdit: boolean;
};
export type Detail = {
  id: string;
  ownerId: string;
  category: Category;
  title: string;
  value: string;
  notes: string;
  link: string;
  visibility: "shared" | "private";
  pinned: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
export type Partnership = { id: string; a: string; b: string };
export type Invitation = {
  id: string;
  ownerId: string;
  hash: string;
  expiresAt: string;
  createdAt: string;
};
export type State = {
  profiles: Profile[];
  details: Detail[];
  partnerships: Partnership[];
  invitations: Invitation[];
  deleted: string[];
};
export type PublicProfile = Omit<Profile, "subject">;
export type Snapshot = {
  me: PublicProfile;
  partner: PublicProfile | null;
  details: Detail[];
  invitations: Omit<Invitation, "hash">[];
};
export type DetailInput = Pick<
  Detail,
  "category" | "title" | "value" | "notes" | "link" | "visibility" | "pinned"
>;
