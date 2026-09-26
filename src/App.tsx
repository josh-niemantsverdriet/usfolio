import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Copy,
  ExternalLink,
  Flower2,
  Gift,
  Grid2X2,
  HeartHandshake,
  HelpCircle,
  Leaf,
  Link,
  Lock,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  categories,
  type Category,
  type Detail,
  type Snapshot,
  type PublicProfile,
} from "../shared/types";
import { demoRequest } from "./demo";
type Auth = {
  loading: boolean;
  error?: string;
  signedIn: boolean;
  token: () => Promise<string>;
  login: () => void;
  logout: () => void;
};
const icons = {
  Sizes: Shirt,
  "Food & drinks": Coffee,
  Favorites: Flower2,
  "Gift ideas": Gift,
};
const categoryClass = (category: Category) =>
  ["sizes", "food", "favorites", "gifts"][categories.indexOf(category)];
const first = (name: string) => name.split(" ")[0];
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function CollectionArt() {
  return (
    <svg
      className="collection-art"
      viewBox="0 0 280 190"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="153" cy="169" rx="99" ry="10" fill="#CBD7C7" opacity=".45" />
      <g transform="rotate(-10 140 100)">
        <rect
          x="68"
          y="28"
          width="143"
          height="127"
          rx="9"
          fill="#F7F5EA"
          stroke="#9FAB94"
        />
        <path
          d="M83 47h33M83 57h57"
          stroke="#B8BCAB"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="155" y="41" width="39" height="35" rx="3" fill="#E9C0AA" />
        <path d="m164 61 7-7 7 7 7-12" stroke="#B77760" strokeWidth="2" />
      </g>
      <g transform="rotate(6 146 123)">
        <path
          d="M65 86a8 8 0 0 1 8-8h43l13 12h87a8 8 0 0 1 8 8v58a9 9 0 0 1-9 9H74a9 9 0 0 1-9-9Z"
          fill="#71917B"
        />
        <path
          d="M61 104a7 7 0 0 1 7-8h151a7 7 0 0 1 7 8l-8 56a9 9 0 0 1-9 8H78a9 9 0 0 1-9-8Z"
          fill="#A7BCA2"
          stroke="#7F9C7C"
        />
        <rect x="116" y="115" width="57" height="28" rx="4" fill="#F5F3E7" />
        <path
          d="M131 126h27M138 133h14"
          stroke="#85947C"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <path d="M232 157c-9-34-6-69 8-106" stroke="#637D60" strokeWidth="2" />
      <path
        d="M232 100c-24-4-25-22-24-27 19 2 24 14 24 27ZM235 80c21-5 24-23 23-29-18 4-24 16-23 29ZM229 124c20-2 30-17 29-24-19 1-27 11-29 24Z"
        fill="#8DA483"
      />
      <path d="m47 76 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="#C48E70" />
      <circle cx="205" cy="25" r="3" fill="#C48E70" />
    </svg>
  );
}

export default function App({ auth }: { auth?: Auth }) {
  const demo = !auth;
  const [data, setData] = useState<Snapshot | null>(null),
    [view, setView] = useState<"partner" | "me">("partner"),
    [category, setCategory] = useState<Category | "all">("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent"),
    [onlyPinned, setOnlyPinned] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<
      "detail" | "settings" | "invite" | "help" | null
    >(null),
    [editing, setEditing] = useState<Detail | null>(null),
    [inviteCode, setInviteCode] = useState(""),
    [acceptCode, setAcceptCode] = useState(
      () => new URLSearchParams(location.hash.slice(1)).get("invite") || "",
    ),
    [confirm, setConfirm] = useState("");
  const pauseRefresh = useRef(false);
  pauseRefresh.current = !!modal || busy;
  useEffect(() => {
    if (modal) setMobileMenu(false);
  }, [modal]);
  const token = auth?.token;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const request = useCallback(
    async (path: string, method = "GET", body?: Record<string, unknown>) => {
      if (demo) return demoRequest(path, method, body);
      const accessToken = await tokenRef.current!();
      const response = await fetch(`/api/${path}`, {
        method,
        headers: {
          "X-Usfolio-Authorization": `Bearer ${accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to load your collection.");
      return result;
    },
    [demo],
  );
  const refresh = useCallback(async () => {
    try {
      const result = await request("me");
      setData(result);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    if (auth?.loading) return;
    if (auth && !auth.signedIn) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [auth?.loading, auth?.signedIn, refresh]);
  useEffect(() => {
    if (!data) return;
    const update = () => {
      if (document.visibilityState === "visible" && !pauseRefresh.current)
        void refresh();
    };
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [!!data, refresh]);
  useEffect(() => {
    if (!data) return;
    if (data.me.name === "Your name") {
      setView("me");
      setModal("settings");
    } else if (acceptCode) setModal("invite");
  }, [!!data]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const mutate = async (
    path: string,
    method: string,
    body?: Record<string, unknown>,
    message = "Saved to your collection.",
  ) => {
    setBusy(true);
    setError("");
    try {
      const result = await request(path, method, body);
      if (result.me) setData(result);
      else await refresh();
      setNotice(message);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (!busy) {
      setModal(null);
      setError("");
      setConfirm("");
    }
  };
  const openDetail = (detail: Detail | null) => {
    setEditing(detail);
    setModal("detail");
    setError("");
  };
  const chooseView = (next: "me" | "partner") => {
    setView(next);
    setCategory("all");
    setQuery("");
    setOnlyPinned(false);
    setMobileMenu(false);
  };
  const profile: PublicProfile | undefined = data
    ? view === "me"
      ? data.me
      : data.partner || undefined
    : undefined;
  const own = view === "me",
    canEdit = own || !!profile?.allowPartnerEdit;
  const details = data?.details.filter((d) => d.ownerId === profile?.id) || [];
  const filtered = details
    .filter(
      (d) =>
        (category === "all" || d.category === category) &&
        (!onlyPinned || d.pinned) &&
        `${d.title} ${d.value} ${d.notes} ${d.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "az"
        ? a.title.localeCompare(b.title)
        : sort === "category"
          ? a.category.localeCompare(b.category)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const attribution = (id: string) =>
    id === data?.me.id
      ? "you"
      : id === data?.partner?.id
        ? first(data.partner.name)
        : id === "deleted"
          ? "Deleted account"
          : "Former partner";
  const saveDetail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      ownerId: profile?.id,
      category: f.get("category"),
      title: f.get("title"),
      value: f.get("value"),
      notes: f.get("notes"),
      link: f.get("link"),
      visibility: own ? f.get("visibility") : "shared",
      pinned: f.get("pinned") === "on",
    };
    const result = await mutate(
      editing ? `details/${editing.id}` : "details",
      editing ? "PUT" : "POST",
      body,
      editing ? "Detail updated." : "A little detail, remembered.",
    );
    if (result) setModal(null);
  };
  if (auth?.loading || loading)
    return (
      <div className="loading-screen">
        <div className="brand">
          usfolio<span>✳</span>
        </div>
        <p>Opening your collection…</p>
      </div>
    );
  if (auth && !auth.signedIn)
    return (
      <div className="welcome">
        <div className="brand">
          usfolio<span>✳</span>
        </div>
        <div className="welcome-art">
          <CollectionArt />
        </div>
        <span className="eyebrow">THOUGHTFULNESS, COLLECTED</span>
        <h1>
          The little things.
          <br />
          All in one place.
        </h1>
        <p>
          Your usual order. Their favorite flowers. A shared collection of the
          details that make you, you.
        </p>
        {auth.error && (
          <p role="alert" className="error">
            {auth.error}
          </p>
        )}
        <button className="primary" onClick={auth.login}>
          Sign in or create an account <ArrowRight size={18} />
        </button>
        <small>Your details. Your choice of what to share.</small>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            chooseView("partner");
          }}
        >
          usfolio<span>✳</span>
        </a>
        <p className="brand-tagline">A little closer, in the details.</p>
        <div className="space-label">YOUR SHARED SPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={view === "partner" ? "nav-link active" : "nav-link"}
            onClick={() => chooseView("partner")}
          >
            <BookOpen size={19} />
            <span>Partner’s collection</span>
            {data?.partner && <span className="nav-dot" />}
          </button>
          <button
            className={view === "me" ? "nav-link active" : "nav-link"}
            onClick={() => chooseView("me")}
          >
            <Grid2X2 size={19} />
            <span>My collection</span>
          </button>
          <button className="nav-link" onClick={() => setModal("invite")}>
            <Users size={19} />
            <span>Our connection</span>
          </button>
        </nav>
        <div className="sidebar-rule" />
        <div className="space-label">THE LITTLE THINGS</div>
        <nav aria-label="Categories">
          {categories.map((c) => {
            const Icon = icons[c];
            return (
              <button
                key={c}
                className={`nav-link category-nav ${category === c ? "selected" : ""}`}
                onClick={() => {
                  setCategory(c);
                  setOnlyPinned(false);
                  setMobileMenu(false);
                }}
              >
                <Icon size={18} />
                <span>{c}</span>
                <ChevronRight size={14} />
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <Leaf size={23} />
          <p>
            Knowing the little things
            <br />
            is a lovely kind of love.
          </p>
          <span>Keep them close.</span>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-link" onClick={() => setModal("help")}>
            <HelpCircle size={19} />A little help
          </button>
          <button
            className="account-button"
            onClick={() => setModal("settings")}
          >
            <span className="avatar small">
              {initials(data?.me.name || "You")}
            </span>
            <span>
              <strong>{data?.me.name || "Your profile"}</strong>
              <small>Your personal space</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobileMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>Our little corner</span>
            <ChevronRight size={14} />
            <strong>{own ? "My collection" : "Partner’s collection"}</strong>
          </div>
          <div className="topbar-right">
            {demo && <span className="demo-badge">Demo space</span>}
            <span className="connection-pill">
              <span className="status-dot" />
              {data?.partner ? "Connected" : "Just you, for now"}
            </span>
            <button
              className="avatar top-avatar"
              onClick={() => setModal("settings")}
              aria-label="Open profile settings"
            >
              {initials(data?.me.name || "You")}
            </button>
          </div>
        </header>
        <main>
          {error && !modal && (
            <div role="alert" className="error alert">
              {error}
              <button className="text-button" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {own
                  ? "A COLLECTION OF YOU"
                  : "A LITTLE KNOWING GOES A LONG WAY"}
              </span>
              <h1>
                {own
                  ? "Your little details."
                  : profile
                    ? `${first(profile.name)}’s collection.`
                    : "A space for the two of you."}
              </h1>
              <p>
                {own
                  ? "The things you love, the way you like them."
                  : profile
                    ? "Their favorites, their usuals, their just-rights. All right here."
                    : "Good things start with a little connection."}
              </p>
            </div>
            <button
              className="primary add-button"
              onClick={() => {
                if (!profile) {
                  setModal("invite");
                  return;
                }
                openDetail(null);
              }}
              disabled={!!profile && !canEdit}
            >
              <Plus size={18} />
              {profile ? "Add a detail" : "Invite your partner"}
            </button>
          </div>
          <section className="collection-banner">
            <div className="banner-content">
              <div className="overline">
                <span className="tiny-leaf">
                  <Leaf size={15} />
                </span>
                {own
                  ? "MADE OF LITTLE THINGS"
                  : "THOUGHTFULNESS, MADE A LITTLE EASIER"}
              </div>
              <h2>
                {own
                  ? "What makes you, you."
                  : "Less guessing. More getting it right."}
              </h2>
              <p>
                {own
                  ? "A few favorites now. A little more, whenever you feel like it."
                  : "From the coffee order to the perfect gift — it’s the little things that say, “I know you.”"}
              </p>
              <div className="banner-foot">
                <span className="mini-avatars">
                  <span>{initials(data?.me.name || "You")}</span>
                  <span>
                    {data?.partner ? initials(data.partner.name) : "+"}
                  </span>
                </span>
                <span>
                  {data?.partner ? (
                    <>
                      A little collection, just for <strong>you two.</strong>
                    </>
                  ) : (
                    <>
                      Your own space. Room for <strong>someone special.</strong>
                    </>
                  )}
                </span>
              </div>
            </div>
            <CollectionArt />
          </section>
          <div className="section-heading">
            <h2>A place for everything</h2>
            <span>
              {details.length} little details{" "}
              <span className="desktop-only">and counting</span>
            </span>
          </div>
          <section className="category-grid" aria-label="Browse categories">
            {categories.map((c) => {
              const Icon = icons[c];
              const count = details.filter((d) => d.category === c).length;
              return (
                <button
                  key={c}
                  className={`category-tile ${categoryClass(c)} ${category === c ? "chosen" : ""}`}
                  onClick={() => {
                    setCategory(category === c ? "all" : c);
                    setOnlyPinned(false);
                  }}
                  aria-pressed={category === c}
                >
                  <span className="category-icon">
                    <Icon size={23} strokeWidth={1.6} />
                  </span>
                  <div>
                    <h3>{c}</h3>
                    <span>
                      {count} {count === 1 ? "detail" : "details"}
                    </span>
                  </div>
                  <ChevronRight size={17} />
                </button>
              );
            })}
          </section>
          <section className="details-section">
            <div className="details-heading">
              <div className="tabs">
                <button
                  className={!onlyPinned ? "tab active" : "tab"}
                  onClick={() => setOnlyPinned(false)}
                >
                  {category === "all" ? "All details" : category}
                  <span>
                    {
                      details.filter(
                        (d) => category === "all" || d.category === category,
                      ).length
                    }
                  </span>
                </button>
                <button
                  className={onlyPinned ? "tab active" : "tab"}
                  onClick={() => setOnlyPinned(true)}
                >
                  <Star size={15} />
                  Quick picks
                </button>
              </div>
              <div className="collection-tools">
                <label className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search details"
                    placeholder="Find a little detail…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <label className="sort-control">
                  <ArrowDownUp size={16} />
                  <select
                    aria-label="Sort details"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recent">Recent</option>
                    <option value="az">A–Z</option>
                    <option value="category">Category</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
            </div>
            {category !== "all" && (
              <button
                className="back-filter text-button"
                onClick={() => setCategory("all")}
              >
                <ArrowLeft size={14} />
                All categories
              </button>
            )}
            {filtered.length ? (
              <div className="detail-grid">
                {filtered.map((detail) => {
                  const Icon = icons[detail.category];
                  return (
                    <article
                      className={`detail-card ${categoryClass(detail.category)}`}
                      key={detail.id}
                    >
                      <div className="card-top">
                        <span className="card-category">
                          <Icon size={14} />
                          {detail.category}
                        </span>
                        {detail.pinned && (
                          <Star
                            className="pinned-star"
                            size={15}
                            fill="currentColor"
                          />
                        )}
                        <button
                          className="card-menu icon-button"
                          onClick={() => openDetail(detail)}
                          aria-label={`View ${detail.title}`}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                      <button
                        className="card-content"
                        onClick={() => openDetail(detail)}
                      >
                        <h3>{detail.title}</h3>
                        <p className="detail-value">{detail.value}</p>
                        <p className="detail-notes">{detail.notes}</p>
                      </button>
                      {detail.link && (
                        <a
                          className="detail-link"
                          href={detail.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Take a peek <ExternalLink size={13} />
                        </a>
                      )}
                      <div className="card-footer">
                        <span>
                          {detail.visibility === "private" ? (
                            <Lock size={12} />
                          ) : (
                            <Users size={12} />
                          )}{" "}
                          {detail.visibility === "private"
                            ? "Only you"
                            : "Shared with " +
                              (own
                                ? data?.partner
                                  ? first(data.partner.name)
                                  : "your partner"
                                : "you")}
                        </span>
                        <span
                          className="author-dot"
                          title={`Created by ${attribution(detail.createdBy)} · Last edited by ${attribution(detail.updatedBy)}`}
                        >
                          {detail.updatedBy === data?.me.id
                            ? initials(data.me.name)
                            : detail.updatedBy === data?.partner?.id
                              ? initials(data.partner.name)
                              : "–"}
                        </span>
                      </div>
                    </article>
                  );
                })}
                <button
                  className="add-card"
                  onClick={() => openDetail(null)}
                  disabled={!canEdit}
                >
                  <span>
                    <Plus size={23} />
                  </span>
                  <strong>A little more to know</strong>
                  <p>
                    {canEdit
                      ? "Add a favorite, a size, a just-so."
                      : "Your partner can add more details."}
                  </p>
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen size={34} />
                <h2>
                  {query
                    ? "Nothing here just yet."
                    : !profile
                      ? "Better together."
                      : onlyPinned
                        ? "Keep your go-to details close."
                        : "Every collection starts with one little thing."}
                </h2>
                <p>
                  {query
                    ? "Try a different word, or look in all categories."
                    : !profile
                      ? "Invite your partner to start sharing the everyday details."
                      : onlyPinned
                        ? "Mark a detail as a quick pick to find it here."
                        : "A coffee order is a pretty good place to start."}
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    if (query) {
                      setQuery("");
                      setCategory("all");
                    } else if (!profile) setModal("invite");
                    else if (canEdit) openDetail(null);
                    else setOnlyPinned(false);
                  }}
                >
                  {query
                    ? "Clear search"
                    : !profile
                      ? "Invite your partner"
                      : canEdit
                        ? "Add your first detail"
                        : "Show all details"}
                </button>
              </div>
            )}
          </section>
          <footer className="page-footer">
            <Leaf size={14} />
            <span>A little attention. A lot of meaning.</span>
            <span className="footer-brand">
              Made for your kind of together.
            </span>
          </footer>
          {demo && (
            <p className="demo-note">
              You’re exploring a sample collection. Changes stay in this
              browser.{" "}
              <button onClick={() => setModal("help")}>
                About this demo <ArrowRight size={12} />
              </button>
            </p>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === "detail"
              ? editing
                ? canEdit
                  ? "A little detail"
                  : "Worth remembering"
                : "Add a little detail"
              : modal === "settings"
                ? "Your personal space"
                : modal === "invite"
                  ? "Your connection"
                  : "A little help"
          }
          close={close}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === "detail" && (
            <form onSubmit={saveDetail} className="detail-form">
              <fieldset disabled={!canEdit || busy}>
                <label>
                  Category
                  <select
                    name="category"
                    defaultValue={
                      editing?.category ||
                      (category === "all" ? "Favorites" : category)
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Give it a name
                  <input
                    name="title"
                    required
                    maxLength={100}
                    placeholder="e.g. My usual coffee"
                    defaultValue={editing?.title}
                  />
                </label>
                <label>
                  The little detail
                  <input
                    name="value"
                    required
                    maxLength={500}
                    placeholder="e.g. Oat milk latte, extra hot"
                    defaultValue={editing?.value}
                  />
                </label>
                <label>
                  Anything else? <span className="optional">optional</span>
                  <textarea
                    name="notes"
                    maxLength={2000}
                    rows={3}
                    placeholder="The size, color, substitutions, or just-right details…"
                    defaultValue={editing?.notes}
                  />
                </label>
                <label>
                  A useful link <span className="optional">optional</span>
                  <input
                    name="link"
                    type="url"
                    pattern="https?://.*"
                    maxLength={2048}
                    placeholder="https://…"
                    defaultValue={editing?.link}
                  />
                </label>
                {own ? (
                  <label>
                    Who can see this?
                    <select
                      name="visibility"
                      defaultValue={editing?.visibility || "shared"}
                    >
                      <option value="shared">Shared with my partner</option>
                      <option value="private">Private — only me</option>
                    </select>
                  </label>
                ) : (
                  <p className="field-hint">
                    <Users size={15} />
                    This detail is shared. Only {profile &&
                      first(profile.name)}{" "}
                    can change its privacy.
                  </p>
                )}
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="pinned"
                    defaultChecked={editing?.pinned}
                  />
                  <span>
                    Add to quick picks
                    <small>Keep this detail easy to reach.</small>
                  </span>
                  <Star size={17} />
                </label>
              </fieldset>
              {editing && (
                <div className="attribution">
                  Created by {attribution(editing.createdBy)} ·{" "}
                  {new Date(editing.createdAt).toLocaleDateString()}
                  <br />
                  Last edited by {attribution(editing.updatedBy)} ·{" "}
                  {new Date(editing.updatedAt).toLocaleDateString()}
                </div>
              )}
              <div className="modal-actions">
                {editing && own && (
                  <button
                    type="button"
                    className="danger-text"
                    disabled={busy}
                    onClick={async () => {
                      if (confirm !== editing.id) {
                        setConfirm(editing.id);
                        return;
                      }
                      if (
                        await mutate(
                          `details/${editing.id}`,
                          "DELETE",
                          undefined,
                          "Detail deleted.",
                        )
                      )
                        setModal(null);
                    }}
                  >
                    <Trash2 size={16} />
                    {confirm === editing.id ? "Confirm delete" : "Delete"}
                  </button>
                )}
                <button type="button" className="secondary" onClick={close}>
                  {canEdit ? "Cancel" : "Close"}
                </button>
                {canEdit && (
                  <button className="primary" disabled={busy}>
                    {busy ? "Saving…" : "Save detail"}
                  </button>
                )}
              </div>
            </form>
          )}
          {modal === "settings" && data && (
            <>
              <form
                className="detail-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await mutate(
                      "me",
                      "PUT",
                      {
                        name: f.get("name"),
                        bio: f.get("bio"),
                        allowPartnerEdit: f.get("allowPartnerEdit") === "on",
                      },
                      "Your profile is updated.",
                    )
                  )
                    setModal(acceptCode ? "invite" : null);
                }}
              >
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    maxLength={60}
                    defaultValue={data.me.name}
                  />
                </label>
                <label>
                  A little about you
                  <textarea
                    name="bio"
                    maxLength={160}
                    rows={2}
                    defaultValue={data.me.bio}
                  />
                </label>
                <label className="checkbox-row setting-row">
                  <input
                    type="checkbox"
                    name="allowPartnerEdit"
                    defaultChecked={data.me.allowPartnerEdit}
                  />
                  <span>
                    Allow my partner to edit my shared details
                    <small>
                      They can add and edit shared details. Private details,
                      visibility, and deleting are always yours.
                    </small>
                  </span>
                </label>
                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={close}>
                    Cancel
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy ? "Saving…" : "Save settings"}
                  </button>
                </div>
              </form>
              <div className="danger-zone">
                <h3>Account</h3>
                {auth && (
                  <button className="text-button" onClick={auth.logout}>
                    <LogOut size={16} />
                    Sign out
                  </button>
                )}
                <p>
                  Deleting your account removes your profile and details and
                  disconnects your partner. This cannot be undone.
                </p>
                <label className="delete-confirm">
                  Type DELETE to confirm
                  <input
                    aria-label="Confirm account deletion"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                <button
                  className="danger-text"
                  disabled={confirm !== "DELETE" || busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await request("me", "DELETE");
                      if (auth) auth.logout();
                      else location.reload();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  {busy
                    ? "Deleting…"
                    : demo
                      ? "Reset demo collection"
                      : "Delete account"}
                </button>
              </div>
            </>
          )}
          {modal === "invite" && data && (
            <div className="connection-content">
              {data.partner ? (
                <>
                  <div className="connection-visual">
                    <span className="avatar">{initials(data.me.name)}</span>
                    <Link size={22} />
                    <span className="avatar partner-avatar">
                      {initials(data.partner.name)}
                    </span>
                  </div>
                  <h3>You & {first(data.partner.name)}</h3>
                  <p>
                    A shared space for the everyday things. Each of you chooses
                    what to share.
                  </p>
                  <div className="privacy-note">
                    <ShieldCheck size={22} />
                    <span>
                      Your private details are always just yours. Only shared
                      details appear in your partner’s collection.
                    </span>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      setModal("settings");
                    }}
                  >
                    Manage my sharing settings
                  </button>
                  <div className="danger-zone">
                    <p>
                      Disconnecting ends access for both of you immediately. You
                      each keep your own details.
                    </p>
                    <button
                      className="danger-text"
                      disabled={busy}
                      onClick={async () => {
                        if (confirm !== "disconnect") {
                          setConfirm("disconnect");
                          return;
                        }
                        if (
                          await mutate(
                            "partnership",
                            "DELETE",
                            undefined,
                            "Disconnected. Your own details are safe.",
                          )
                        ) {
                          setView("me");
                          setConfirm("");
                        }
                      }}
                    >
                      {confirm === "disconnect"
                        ? "Yes, disconnect"
                        : "Disconnect from partner"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="connection-visual">
                    <Users size={36} />
                  </div>
                  <h3>A little closer starts here.</h3>
                  <p>
                    Create an invitation and send it to your partner. It can be
                    used once, within 24 hours.
                  </p>
                  {demo && (
                    <p className="privacy-note">
                      This is a local demo. Invitations work between real
                      accounts once sign-in and the API are configured.
                    </p>
                  )}
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={async () => {
                      const result = await mutate(
                        "invitations",
                        "POST",
                        {},
                        "Invitation created.",
                      );
                      if (result) setInviteCode(result.code);
                    }}
                  >
                    <Plus size={17} />
                    {data.invitations.length
                      ? "Create a replacement invitation"
                      : "Create invitation"}
                  </button>
                  {inviteCode && (
                    <div className="invite-result">
                      <label>
                        Invitation link
                        <input
                          readOnly
                          value={`${location.origin}/#invite=${inviteCode}`}
                        />
                      </label>
                      <button
                        className="secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              `${location.origin}/#invite=${inviteCode}`,
                            );
                            setNotice("Invitation link copied.");
                          } catch {
                            setError(
                              "Could not copy. Select and copy the link above.",
                            );
                          }
                        }}
                      >
                        <Copy size={16} />
                        Copy link
                      </button>
                    </div>
                  )}
                  {data.invitations.length > 0 && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await mutate(
                            "invitations",
                            "DELETE",
                            undefined,
                            "Invitation revoked.",
                          )
                        )
                          setInviteCode("");
                      }}
                    >
                      Revoke active invitation
                    </button>
                  )}
                  <form
                    className="accept-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      let code = acceptCode.trim();
                      try {
                        if (code.startsWith("http"))
                          code =
                            new URLSearchParams(
                              new URL(code).hash.slice(1),
                            ).get("invite") || "";
                      } catch {
                        setError("Enter a valid invitation link or code.");
                        return;
                      }
                      if (
                        await mutate(
                          "invitations/accept",
                          "POST",
                          { code },
                          "You’re connected.",
                        )
                      ) {
                        setAcceptCode("");
                        history.replaceState({}, "", "/");
                        setModal(null);
                        setView("partner");
                      }
                    }}
                  >
                    <label>
                      Have an invitation?
                      <input
                        required
                        value={acceptCode}
                        onChange={(e) => setAcceptCode(e.target.value)}
                        placeholder="Paste your partner’s link or code"
                      />
                    </label>
                    <button className="secondary" disabled={busy}>
                      Accept invitation <ArrowRight size={16} />
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
          {modal === "help" && (
            <div className="help-content">
              <div className="help-icon">
                <HeartHandshake size={32} />
              </div>
              <h3>Thoughtfulness, collected.</h3>
              <p>
                Usfolio is a home for the everyday details: the right size,
                their usual order, something they’d love.
              </p>
              <p>
                <strong>Your collection</strong> is yours to fill in. Choose
                shared or private for each detail. Your partner can only see
                what you share.
              </p>
              <p>
                <strong>Quick picks</strong> keep frequently used details close.
                Open a detail and mark it as a quick pick.
              </p>
              <p>
                <strong>Partner editing</strong> is off by default. You can turn
                it on in your profile settings, and turn it off at any time.
              </p>
              {demo && (
                <div className="privacy-note">
                  You’re in a sample space as Alex, with Jamie’s shared
                  collection. Demo changes are saved only in this browser, with
                  no account or server connection. Real sign-in requires the
                  Auth0 and Azure SQL settings described in the project README.
                </div>
              )}
              <button className="primary" onClick={close}>
                Got it <Check size={17} />
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
