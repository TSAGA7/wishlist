import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  Bell,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Link2,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { buildBackup, parseBackup } from "@/lib/backup";
import {
  CURRENCIES,
  currencyLabel,
  formatMoney,
  goodsWord,
  parseAmount,
  wishesWord,
  type Currency,
} from "@/lib/money";
import { parseProduct } from "@/lib/parse-product";
import { setTheme } from "@/components/theme-boot";
import {
  DEFAULT_NAME,
  loadWishlist,
  putWish,
  removeWish,
  replaceWishlist,
  saveOrder,
  saveProfile,
  type Wish,
} from "@/lib/wishlist-db";

type Screen = "home" | "archive" | "backups" | "settings";
type Filter = "all" | "active" | "archive";

interface Draft {
  id: string | null;
  url: string;
  title: string;
  price: string;
  currency: Currency;
  note: string;
  image: string | null;
  archived: boolean;
  priceAuto: boolean;
}

type Overlay =
  | { kind: "edit"; draft: Draft }
  | { kind: "install" }
  | { kind: "import"; name: string | null; wishes: Wish[] }
  | null;

function emptyDraft(currency: Currency): Draft {
  return {
    id: null,
    url: "",
    title: "",
    price: "",
    currency,
    note: "",
    image: null,
    archived: false,
    priceAuto: false,
  };
}

function draftFromWish(wish: Wish): Draft {
  return {
    id: wish.id,
    url: wish.url,
    title: wish.title,
    price: wish.price == null ? "" : String(wish.price),
    currency: wish.currency,
    note: wish.note,
    image: wish.image,
    archived: wish.archived,
    priceAuto: wish.priceAuto,
  };
}

function canonicalUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function hostOf(url: string): string | null {
  const canonical = canonicalUrl(url);
  if (!canonical) return null;
  try {
    return new URL(canonical).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function WishlistApp() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [currency, setCurrency] = useState<Currency>("RUB");
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [screen, setScreen] = useState<Screen>("home");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [bell, setBell] = useState(false);
  const [dark, setDark] = useState(true);
  const [importReady, setImportReady] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(DEFAULT_NAME);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    let alive = true;
    loadWishlist()
      .then((data) => {
        if (!alive) return;
        setName(data.name);
        setNameDraft(data.name);
        setCurrency(data.currency);
        setWishes(data.wishes);
      })
      .catch(() => toast.error("Не удалось открыть список на устройстве"));
    setImportReady(true);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, []);

  const active = wishes.filter((wish) => !wish.archived);
  const archived = wishes.filter((wish) => wish.archived);
  const needle = query.trim().toLowerCase();

  const homeItems = useMemo(() => {
    const pool =
      filter === "active" ? wishes.filter((wish) => !wish.archived) : filter === "archive" ? archived : wishes;
    const filtered = needle
      ? pool.filter((wish) => `${wish.title}\n${wish.note}\n${wish.url}`.toLowerCase().includes(needle))
      : pool;
    return [...filtered].sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
  }, [archived, filter, needle, wishes]);

  function applyTheme(mode: "light" | "dark") {
    setDark(setTheme(mode));
  }

  async function commitName() {
    const next = nameDraft.trim().slice(0, 40) || DEFAULT_NAME;
    setName(next);
    setNameDraft(next);
    setEditingName(false);
    try {
      await saveProfile({ name: next });
    } catch {
      toast.error("Имя не сохранилось");
    }
  }

  async function changeCurrency(next: Currency) {
    setCurrency(next);
    try {
      await saveProfile({ currency: next });
    } catch {
      toast.error("Валюта не сохранилась");
    }
  }

  function openCreate() {
    setOverlay({ kind: "edit", draft: emptyDraft(currency) });
  }

  async function saveDraft(draft: Draft) {
    const title = draft.title.trim();
    if (!title) {
      toast.error("Добавьте название");
      return;
    }
    const price = parseAmount(draft.price);
    if (draft.price.trim() && price == null) {
      toast.error("Цена выглядит странно");
      return;
    }
    const now = Date.now();
    const existing = draft.id ? wishes.find((wish) => wish.id === draft.id) : undefined;
    const order = existing?.order ?? (wishes.length ? Math.min(...wishes.map((wish) => wish.order)) - 1 : 0);
    const wish: Wish = {
      id: draft.id ?? crypto.randomUUID(),
      title: title.slice(0, 180),
      price,
      currency: draft.currency,
      note: draft.note.trim().slice(0, 500),
      url: canonicalUrl(draft.url),
      image: draft.image,
      priceAuto: draft.priceAuto && price != null,
      archived: draft.archived,
      order,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const previous = wishes;
    setWishes((current) => [...current.filter((item) => item.id !== wish.id), wish]);
    setOverlay(null);
    try {
      await putWish(wish);
      toast.success(existing ? "Сохранили" : "Добавили в список");
    } catch {
      setWishes(previous);
      toast.error("Не удалось сохранить");
    }
  }

  async function setArchived(wish: Wish, archivedFlag: boolean) {
    const next = { ...wish, archived: archivedFlag, updatedAt: Date.now() };
    const previous = wishes;
    setWishes((current) => current.map((item) => (item.id === wish.id ? next : item)));
    try {
      await putWish(next);
      toast(archivedFlag ? "В архиве" : "Снова в списке", {
        action: {
          label: "Отменить",
          onClick: () => {
            setWishes(previous);
            void putWish(wish);
          },
        },
      });
    } catch {
      setWishes(previous);
      toast.error("Не получилось");
    }
  }

  async function deleteWish(wish: Wish) {
    const previous = wishes;
    setWishes((current) => current.filter((item) => item.id !== wish.id));
    try {
      await removeWish(wish.id);
      toast("Удалили", {
        action: {
          label: "Вернуть",
          onClick: () => {
            setWishes(previous);
            void putWish(wish);
          },
        },
      });
    } catch {
      setWishes(previous);
      toast.error("Не удалось удалить");
    }
  }

  async function reorder(ids: string[]) {
    const orderOf = new Map(ids.map((id, index) => [id, index]));
    const previous = wishes;
    setWishes((current) =>
      current.map((wish) => (orderOf.has(wish.id) ? { ...wish, order: orderOf.get(wish.id)! } : wish)),
    );
    try {
      await saveOrder(ids);
    } catch {
      setWishes(previous);
      toast.error("Порядок не сохранился");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(buildBackup(name, wishes), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wishlist.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Файл с копией скачан");
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBackup(JSON.parse(String(reader.result)));
        if (!parsed || !parsed.wishes.length) {
          toast.error("В файле нет хотелок");
          return;
        }
        setOverlay({ kind: "import", name: parsed.name, wishes: parsed.wishes });
      } catch {
        toast.error("Файл не читается");
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport(nextName: string | null, nextWishes: Wish[]) {
    const previous = { name, wishes };
    if (nextName?.trim()) {
      setName(nextName.trim());
      setNameDraft(nextName.trim());
    }
    setWishes(nextWishes);
    setOverlay(null);
    try {
      await replaceWishlist(nextName, nextWishes);
      toast.success("Список заменён копией");
    } catch {
      setName(previous.name);
      setWishes(previous.wishes);
      toast.error("Не удалось восстановить копию");
    }
  }

  const totals = useMemo(() => sumByCurrency(filter === "archive" ? archived : active), [active, archived, filter]);

  return (
    <div className="shell">
      <aside className="side">
        <div className="topbar">
          <Mark />
          <div className="brand-copy">
            <strong>Wishlist</strong>
            <small>Мои хотелки</small>
          </div>
        </div>
        <nav>
          <SideLink current={screen === "home"} icon={<Bookmark className="size-4" />} label="Мои хотелки" count={wishes.length} onClick={() => setScreen("home")} />
          <SideLink current={screen === "archive"} icon={<Archive className="size-4" />} label="Архив" count={archived.length} onClick={() => setScreen("archive")} />
          <SideLink current={screen === "backups"} icon={<Download className="size-4" />} label="Резервные копии" onClick={() => setScreen("backups")} />
          <SideLink current={screen === "settings"} icon={<Settings className="size-4" />} label="Настройки" onClick={() => setScreen("settings")} />
        </nav>
      </aside>

      <div className={screen === "home" ? "stage" : "stage stage-plain"}>
        {screen === "home" ? (
          <header className="mobile-only topbar">
            <Mark />
            <div className="brand-copy">
              <strong>Wishlist</strong>
            </div>
            <div className="relative">
              <button type="button" className="icon-btn" aria-label="Уведомления" onClick={() => setBell((open) => !open)}>
                <Bell className="size-5" />
              </button>
              {bell ? (
                <div className="glass menu-pop">
                  <p className="px-3 py-3 text-sm text-muted">Пока без уведомлений</p>
                </div>
              ) : null}
            </div>
            <button type="button" className="icon-btn" aria-label="Настройки" onClick={() => setScreen("settings")}>
              <Settings className="size-5" />
            </button>
          </header>
        ) : null}

        <div className="desktop-toolbar">
          <h1>{screen === "home" ? name : screen === "archive" ? "Архив" : screen === "backups" ? "Резервные копии" : "Настройки"}</h1>
          {screen === "home" ? <SearchField value={query} onChange={setQuery} /> : null}
          {screen === "home" ? (
            <button type="button" className="add-desktop" onClick={openCreate}>
              <Plus className="size-4" /> Добавить
            </button>
          ) : null}
        </div>

        {screen === "home" ? (
          <>
            <div className="mobile-only">
              <SearchField value={query} onChange={setQuery} />
            </div>
            <Hero
              name={name}
              editing={editingName}
              nameDraft={nameDraft}
              onDraft={setNameDraft}
              onEdit={() => {
                setNameDraft(name);
                setEditingName(true);
              }}
              onCommit={() => void commitName()}
              wishes={filter === "archive" ? archived : filter === "active" ? active : wishes}
              totals={totals}
            />
            <div className="pills" role="tablist">
              <FilterPill pressed={filter === "all"} onClick={() => setFilter("all")} label={`Все (${wishes.length})`} />
              <FilterPill pressed={filter === "active"} onClick={() => setFilter("active")} label={`Активные (${active.length})`} />
              <FilterPill pressed={filter === "archive"} onClick={() => setFilter("archive")} label={`Архив (${archived.length})`} />
            </div>
            {homeItems.length === 0 ? (
              <Empty
                text={needle ? "Ничего не нашли" : "Пока пусто"}
                hint={needle ? "Попробуйте другое слово" : "Вставьте ссылку — название, цена и фото подтянутся сами."}
              />
            ) : (
              <WishReorder
                items={homeItems}
                dragEnabled={!needle}
                onOpen={(wish) => setOverlay({ kind: "edit", draft: draftFromWish(wish) })}
                onArchive={(wish) => void setArchived(wish, !wish.archived)}
                onDelete={(wish) => void deleteWish(wish)}
                onReorder={(ids) => void reorder(ids)}
              />
            )}
          </>
        ) : null}

        {screen === "archive" ? (
          <ArchiveScreen
            items={[...archived].sort((a, b) => b.updatedAt - a.updatedAt)}
            onBack={() => setScreen("home")}
            onOpen={(wish) => setOverlay({ kind: "edit", draft: draftFromWish(wish) })}
            onRestore={(wish) => void setArchived(wish, false)}
            onDelete={(wish) => void deleteWish(wish)}
          />
        ) : null}

        {screen === "settings" ? (
          <SettingsScreen
            dark={dark}
            currency={currency}
            onTheme={applyTheme}
            onCurrency={(value) => void changeCurrency(value)}
            onExport={exportJson}
            onImport={() => fileRef.current?.click()}
            onInstall={() => setOverlay({ kind: "install" })}
            onBack={() => setScreen("home")}
          />
        ) : null}

        {screen === "backups" ? (
          <BackupsScreen
            count={wishes.length}
            onBack={() => setScreen("home")}
            onExport={exportJson}
            onImport={() => fileRef.current?.click()}
          />
        ) : null}
      </div>

      {screen === "home" && !overlay ? (
        <button type="button" className="fab" aria-label="Добавить" onClick={openCreate}>
          <Plus className="size-6" />
        </button>
      ) : null}

      {screen === "home" ? (
        <nav className="dock glass">
          <DockButton current={screen === "home"} label="Хотелки" icon={<Bookmark className="size-5" />} onClick={() => setScreen("home")} />
          <DockButton current={false} label="Архив" icon={<Archive className="size-5" />} onClick={() => setScreen("archive")} />
          <DockButton current={false} label="Резервные копии" icon={<ArrowUpDown className="size-5" />} onClick={() => setScreen("backups")} />
        </nav>
      ) : null}

      {overlay?.kind === "edit" ? (
        <EditorSheet draft={overlay.draft} onClose={() => setOverlay(null)} onSave={(draft) => void saveDraft(draft)} />
      ) : null}
      {overlay?.kind === "install" ? <InstallSheet onClose={() => setOverlay(null)} /> : null}
      {overlay?.kind === "import" ? (
        <ConfirmSheet
          title="Заменить список?"
          body={`В файле ${overlay.wishes.length} ${wishesWord(overlay.wishes.length)}. Текущие хотелки на этом устройстве будут заменены.`}
          onClose={() => setOverlay(null)}
          onConfirm={() => void confirmImport(overlay.name, overlay.wishes)}
        />
      ) : null}

      {importReady ? (
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onImportFile(file);
          }}
        />
      ) : null}
      <Toaster
        position="top-center"
        theme={dark ? "dark" : "light"}
        toastOptions={{
          style: {
            background: "rgba(20,24,36,0.92)",
            color: "#f5f7fb",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "16px",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </div>
  );
}

function sumByCurrency(items: Wish[]) {
  return CURRENCIES.map((code) => ({
    currency: code,
    sum: items.filter((wish) => wish.currency === code && wish.price != null).reduce((total, wish) => total + (wish.price ?? 0), 0),
    count: items.filter((wish) => wish.currency === code && wish.price != null).length,
  }))
    .filter((group) => group.count > 0)
    .sort((a, b) => b.count - a.count);
}

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Bookmark className="size-5" />
    </span>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="search glass">
      <Search className="size-4 shrink-0 opacity-70" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Поиск по хотелкам..." aria-label="Поиск" />
    </label>
  );
}

function Hero({
  name,
  editing,
  nameDraft,
  onDraft,
  onEdit,
  onCommit,
  wishes,
  totals,
}: {
  name: string;
  editing: boolean;
  nameDraft: string;
  onDraft: (value: string) => void;
  onEdit: () => void;
  onCommit: () => void;
  wishes: Wish[];
  totals: { currency: Currency; sum: number; count: number }[];
}) {
  const hero = totals[0];
  const heights = spark(wishes);
  return (
    <section className="hero">
      {editing ? (
        <input
          autoFocus
          value={nameDraft}
          maxLength={40}
          aria-label="Название списка"
          onChange={(event) => onDraft(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCommit();
          }}
          className="field"
        />
      ) : (
        <button type="button" onClick={onEdit} className="text-left">
          <p>{name}</p>
        </button>
      )}
      <div className="hero-sum">{hero ? formatMoney(hero.sum, hero.currency) : formatMoney(0, "RUB")}</div>
      <div className="hero-meta">
        {wishes.length} {goodsWord(wishes.length)}
      </div>
      {totals.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {totals.slice(1).map((group) => (
            <span key={group.currency} className="badge">
              {formatMoney(group.sum, group.currency)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="bars" data-idle={wishes.every((wish) => wish.price == null) ? "true" : "false"} aria-hidden="true">
        {heights.map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  );
}

function spark(wishes: Wish[]): number[] {
  const values = wishes.map((wish) => wish.price ?? 0).filter((value) => value > 0).slice(0, 7);
  if (!values.length) return [28, 46, 34, 62, 40, 70, 52];
  const max = Math.max(...values);
  return values.map((value) => Math.max(18, Math.round((value / max) * 100)));
}

function FilterPill({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="pill" role="tab" aria-selected={pressed} aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );
}

function WishReorder({
  items,
  dragEnabled,
  onOpen,
  onArchive,
  onDelete,
  onReorder,
}: {
  items: Wish[];
  dragEnabled: boolean;
  onOpen: (wish: Wish) => void;
  onArchive: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [rows, setRows] = useState(items);
  const [lifted, setLifted] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rowsRef = useRef(rows);
  const dragging = useRef<string | null>(null);
  rowsRef.current = rows;

  useEffect(() => {
    if (!dragging.current) setRows(items);
  }, [items]);

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (!dragEnabled) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    dragging.current = id;
    setLifted(id);
    let lastY = event.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - lastY) < 14 && Math.abs(ev.clientX - event.clientX) < 14) return;
      const list = listRef.current;
      if (!list) return;
      const next = reorderByPointer(rowsRef.current, id, ev.clientX, ev.clientY, list);
      if (next === rowsRef.current) return;
      lastY = ev.clientY;
      rowsRef.current = next;
      setRows(next);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      dragging.current = null;
      setLifted(null);
      onReorder(rowsRef.current.map((wish) => wish.id));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  return (
    <ul ref={listRef} className="cards poster">
      {rows.map((wish, index) => (
        <li key={wish.id} data-wish-id={wish.id} className="card-in relative" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
          <WishCard
            wish={wish}
            lifted={lifted === wish.id}
            onOpen={() => onOpen(wish)}
            onArchive={() => onArchive(wish)}
            onDelete={() => onDelete(wish)}
            onGripDown={(event) => onGripDown(event, wish.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function reorderByPointer(list: Wish[], id: string, clientX: number, clientY: number, container: HTMLElement): Wish[] {
  const from = list.findIndex((wish) => wish.id === id);
  if (from < 0) return list;
  const cards = [...container.querySelectorAll<HTMLElement>("[data-wish-id]")];
  let to = list.length - 1;
  for (let index = 0; index < cards.length; index += 1) {
    const box = cards[index]!.getBoundingClientRect();
    const midY = box.top + box.height / 2;
    const midX = box.left + box.width / 2;
    const sameRow = Math.abs(clientY - midY) <= box.height / 2;
    if (clientY < midY - 4 || (sameRow && clientX < midX)) {
      to = index;
      break;
    }
  }
  if (to === from) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  if (!item) return list;
  next.splice(to, 0, item);
  return next;
}

function WishCard({
  wish,
  lifted,
  onOpen,
  onArchive,
  onDelete,
  onGripDown,
  archivedView = false,
}: {
  wish: Wish;
  lifted?: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onGripDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  archivedView?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <article className={`wish glass ${lifted ? "lifted" : ""}`}>
      <button type="button" className="thumb-fallback thumb touch-none" aria-label="Перетащить" onPointerDown={onGripDown} onClick={(event) => event.stopPropagation()}>
        <Thumb src={wish.image} />
      </button>
      <button type="button" className="wish-copy" onClick={onOpen}>
        <strong>{wish.title}</strong>
        <span className="wish-price">
          {wish.price == null ? "Без цены" : formatMoney(wish.price, wish.currency)}
          {wish.priceAuto ? <span className="badge">auto</span> : null}
        </span>
      </button>
      <div className="relative">
        <button type="button" className="icon-btn" aria-label="Действия" onClick={() => setMenu((open) => !open)}>
          <MoreHorizontal className="size-5" />
        </button>
        {menu ? (
          <div className="glass pop">
            <button type="button" onClick={() => { setMenu(false); onOpen(); }}>Изменить</button>
            <button type="button" onClick={() => { setMenu(false); onArchive(); }}>{archivedView || wish.archived ? "Вернуть" : "В архив"}</button>
            {wish.url ? (
              <a href={wish.url} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>Открыть</a>
            ) : null}
            <button type="button" onClick={() => { setMenu(false); onDelete(); }}>Удалить</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Bookmark className="size-5" />;
  return <img src={src} alt="" className="thumb" onError={() => setFailed(true)} />;
}

function ArchiveScreen({
  items,
  onBack,
  onOpen,
  onRestore,
  onDelete,
}: {
  items: Wish[];
  onBack: () => void;
  onOpen: (wish: Wish) => void;
  onRestore: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
}) {
  return (
    <section>
      <div className="page-head mobile-only">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Архив</h1>
        <span className="icon-btn" aria-hidden="true">
          <Archive className="size-5" />
        </span>
      </div>
      <div className="center-intro">
        <div className="orb glass">
          <Archive className="size-7" />
        </div>
        <h2>Архив</h2>
        <p>Здесь хранятся товары, которые пока не актуальны</p>
      </div>
      <p className="text-sm text-muted">В архиве: {items.length}</p>
      {items.length === 0 ? (
        <Empty text="Архив пуст" hint="Сюда попадают желания, которые пока не актуальны." />
      ) : (
        <ul className="cards">
          {items.map((wish) => (
            <li key={wish.id}>
              <article className="wish glass">
                <button type="button" className="wish-copy flex items-center gap-3" onClick={() => onOpen(wish)}>
                  <span className="thumb thumb-fallback">
                    <Thumb src={wish.image} />
                  </span>
                  <span>
                    <strong>{wish.title}</strong>
                    <span className="wish-price">{wish.price == null ? "Без цены" : formatMoney(wish.price, wish.currency)}</span>
                  </span>
                </button>
                <button type="button" className="icon-btn" aria-label="Вернуть" onClick={() => onRestore(wish)}>
                  <ArchiveRestore className="size-5" />
                </button>
                <button type="button" className="icon-btn" aria-label="Удалить" onClick={() => onDelete(wish)}>
                  <Trash2 className="size-5" />
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SettingsScreen({
  dark,
  currency,
  onTheme,
  onCurrency,
  onExport,
  onImport,
  onInstall,
  onBack,
}: {
  dark: boolean;
  currency: Currency;
  onTheme: (mode: "light" | "dark") => void;
  onCurrency: (currency: Currency) => void;
  onExport: () => void;
  onImport: () => void;
  onInstall: () => void;
  onBack: () => void;
}) {
  const [about, setAbout] = useState(false);
  return (
    <section>
      <div className="page-head mobile-only">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Настройки</h1>
        <span className="icon-btn" aria-hidden="true">
          <Settings className="size-5" />
        </span>
      </div>
      <div className="settings-list">
        <div className="row glass appearance">
          <span className="section-label">Внешний вид</span>
          <div className="segment wide">
            <button type="button" aria-pressed={!dark} onClick={() => onTheme("light")}>
              <Sun className="size-4" /> Светлая
            </button>
            <button type="button" aria-pressed={dark} onClick={() => onTheme("dark")}>
              <Moon className="size-4" /> Тёмная
            </button>
          </div>
        </div>
        <label className="row glass">
          <span className="grow">Валюта по умолчанию</span>
          <select className="currency-select" value={currency} onChange={(event) => onCurrency(event.target.value as Currency)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabel(code)} ({code})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="row glass" onClick={onExport}>
          <Download className="size-5" /> <span className="grow">Экспорт данных (JSON)</span>
        </button>
        <button type="button" className="row glass" onClick={onImport}>
          <Upload className="size-5" /> <span className="grow">Импорт данных (JSON)</span>
        </button>
        <button type="button" className="row glass" aria-expanded={about} onClick={() => setAbout((open) => !open)}>
          <Info className="size-5" />
          <span className="grow">
            <strong>О приложении</strong>
          </span>
          <ChevronRight className={`size-4 shrink-0 transition ${about ? "rotate-90" : ""}`} />
        </button>
        {about ? (
          <p className="about-copy">
            Список живёт только на этом устройстве. Ссылка подтягивает название, цену и фото, когда страница это отдаёт. Копия JSON возвращает список, если очистите браузер.
          </p>
        ) : null}
        <button type="button" className="install-card glass" onClick={onInstall}>
          <span className="phone-badge">
            <Smartphone className="size-5" />
          </span>
          <span className="grow">
            <strong>Установи Wishlist как приложение</strong>
            <small>Работает офлайн, быстро и всегда под рукой.</small>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      </div>
    </section>
  );
}

function BackupsScreen({
  count,
  onBack,
  onExport,
  onImport,
}: {
  count: number;
  onBack: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <section>
      <div className="page-head mobile-only">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Резервные копии</h1>
        <span className="w-11" />
      </div>
      <p className="mt-2 text-muted">В списке {count} {wishesWord(count)}. Файл JSON можно сохранить и вернуть на это устройство.</p>
      <div className="backup-list">
        <button type="button" className="row glass" onClick={onExport}>
          <Download className="size-5" /> Экспорт JSON
        </button>
        <button type="button" className="row glass" onClick={onImport}>
          <Upload className="size-5" /> Импорт JSON
        </button>
      </div>
    </section>
  );
}

function EditorSheet({
  draft,
  onClose,
  onSave,
}: {
  draft: Draft;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [form, setForm] = useState(draft);
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastParsed = useRef("");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function pull(raw: string, force: boolean) {
    const url = raw.trim();
    if (!url) {
      setStatus("Вставьте ссылку или заполните поля сами");
      return;
    }
    if (!force && url === lastParsed.current) return;
    setParsing(true);
    setStatus("Смотрим страницу…");
    try {
      const result = await parseProduct({ data: { url } });
      lastParsed.current = url;
      if (result.error) {
        setStatus(result.error);
        return;
      }
      if (!result.title && result.price == null && !result.image) {
        setStatus("На странице нет названия и цены — впишите их сами");
        return;
      }
      setForm((current) => {
        const takePrice = result.price != null && (force || !current.price.trim());
        return {
          ...current,
          url: current.url.trim() ? current.url : url,
          title: result.title && (force || !current.title.trim()) ? result.title : current.title,
          price: takePrice ? String(result.price) : current.price,
          currency: result.currency && takePrice ? result.currency : current.currency,
          image: result.image && (force || !current.image) ? result.image : current.image,
          priceAuto: takePrice ? true : current.priceAuto,
        };
      });
      setStatus(hostOf(url) ? `Подтянули со страницы ${hostOf(url)}` : "Подтянули, что нашлось");
    } catch {
      setStatus("Страница не открылась. Можно заполнить вручную");
    } finally {
      setParsing(false);
    }
  }

  function onHandleDown(event: ReactPointerEvent<HTMLDivElement>) {
    const start = event.clientY;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      const dy = Math.max(0, ev.clientY - start);
      if (sheetRef.current && window.innerWidth < 960) sheetRef.current.style.transform = `translateY(${dy}px)`;
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      if (ev.clientY - start > 90) onClose();
      else if (sheetRef.current) sheetRef.current.style.transform = "";
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div ref={sheetRef} className="sheet rise" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="handle" onPointerDown={onHandleDown} />
        <div className="mb-3 flex items-center justify-between">
          <h2 id="editor-title" className="text-xl font-semibold">{form.id ? "Редактировать" : "Добавить хотелку"}</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
        >
          <label className="block">
            <span className="label">Ссылка</span>
            <span className="flex gap-2">
              <span className="relative min-w-0 flex-1">
                <Link2 className="pointer-events-none absolute top-3.5 left-3 size-4 opacity-60" />
                <input
                  value={form.url}
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="https://"
                  onChange={(event) => setForm({ ...form, url: event.target.value })}
                  onBlur={() => {
                    if (form.url.trim()) void pull(form.url, false);
                  }}
                  onPaste={(event) => {
                    const text = event.clipboardData.getData("text");
                    if (text.trim()) void pull(text, false);
                  }}
                  className="field url-field"
                />
                {form.url ? (
                  <button
                    type="button"
                    className="field-clear"
                    aria-label="Очистить ссылку"
                    onClick={() => setForm({ ...form, url: "" })}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </span>
              <button type="button" className="field w-auto px-4" disabled={parsing} onClick={() => void pull(form.url, true)}>
                {parsing ? "…" : "Найти"}
              </button>
            </span>
            <span className="mt-1 block min-h-5 text-sm text-muted">{status}</span>
          </label>
          {form.title || form.image ? (
            <div className="found glass">
              <span className="thumb thumb-fallback">
                <Thumb src={form.image} />
              </span>
              <span>
                <strong>{form.title || "Без названия"}</strong>
                <span className="block text-sm text-muted">{hostOf(form.url) ?? "Ссылка"}</span>
              </span>
            </div>
          ) : null}
          <label className="block">
            <span className="label">Название</span>
            <input required value={form.title} maxLength={180} onChange={(event) => setForm({ ...form, title: event.target.value })} className="field" />
          </label>
          <div className="grid grid-cols-[1fr_7.5rem] gap-2">
            <label>
              <span className="label">Цена</span>
              <input
                inputMode="decimal"
                value={form.price}
                placeholder="0"
                onChange={(event) => setForm({ ...form, price: event.target.value, priceAuto: false })}
                className="field tabular-nums"
              />
            </label>
            <label>
              <span className="label">Валюта</span>
              <select className="field" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Currency })}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {currencyLabel(code)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">Заметка (необязательно)</span>
            <textarea value={form.note} maxLength={500} rows={3} placeholder="Для себя" onChange={(event) => setForm({ ...form, note: event.target.value })} className="field" />
          </label>
          <button type="button" className="switch" role="switch" aria-checked={form.archived} onClick={() => setForm({ ...form, archived: !form.archived })}>
            <span>В архив</span>
            <span className="knob-track" data-on={form.archived}>
              <span className="knob" />
            </span>
          </button>
          <button type="submit" className="save">
            <Check className="size-5" /> Сохранить
          </button>
          <button type="button" className="cancel" onClick={onClose}>
            Отмена
          </button>
        </form>
      </div>
    </div>
  );
}

function InstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">Добавить на экран «Домой»?</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <p className="text-muted">Установите Wishlist как приложение на iPhone: Safari → Поделиться → На экран «Домой».</p>
        <button type="button" className="save mt-4" onClick={onClose}>
          Добавить
        </button>
      </div>
    </div>
  );
}

function ConfirmSheet({
  title,
  body,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-muted">{body}</p>
        <button type="button" className="save mt-4" onClick={onConfirm}>
          Заменить
        </button>
        <button type="button" className="cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function DockButton({
  current,
  label,
  icon,
  onClick,
}: {
  current: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-current={current ? "page" : undefined} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function SideLink({
  current,
  icon,
  label,
  count,
  onClick,
}: {
  current: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-current={current ? "page" : undefined} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {count != null ? <span className="count">{count}</span> : null}
    </button>
  );
}

function Empty({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="empty-card glass">
      <span className="orb">
        <Bookmark className="size-6" />
      </span>
      <strong>{text}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}
