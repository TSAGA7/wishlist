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
  type Collection,
  type Priority,
} from "@/lib/wishlist-db";

type Screen = "home" | "archive" | "backups" | "settings" | "collections" | "map";
type Filter = "all" | "purchases" | "trips" | "active" | "archive";

interface Draft {
  id: string | null;
  kind: "purchase" | "trip";
  url: string;
  title: string;
  price: string;
  currency: Currency;
  note: string;
  image: string | null;
  archived: boolean;
  priceAuto: boolean;
  priority: Priority;
  collectionId: string | null;
  // savings
  targetAmount: string;
  savedAmount: string;
  deadline: string;
  // trip
  countries: string;
  cities: string;
  startDate: string;
  endDate: string;
}

type Overlay =
  | { kind: "edit"; draft: Draft }
  | { kind: "view"; wish: Wish }
  | { kind: "install" }
  | { kind: "import"; name: string | null; wishes: Wish[]; collections: Collection[] }
  | { kind: "add-choice" }
  | null;

function emptyDraft(currency: Currency, kind: "purchase" | "trip" = "purchase"): Draft {
  return {
    id: null,
    kind,
    url: "",
    title: "",
    price: "",
    currency,
    note: "",
    image: null,
    archived: false,
    priceAuto: false,
    priority: "medium",
    collectionId: null,
    targetAmount: "",
    savedAmount: "0",
    deadline: "",
    countries: "",
    cities: "",
    startDate: "",
    endDate: "",
  };
}

function draftFromWish(wish: Wish): Draft {
  return {
    id: wish.id,
    kind: wish.kind,
    url: wish.url,
    title: wish.title,
    price: wish.price == null ? "" : String(wish.price),
    currency: wish.currency,
    note: wish.note,
    image: wish.image,
    archived: wish.archived,
    priceAuto: wish.priceAuto,
    priority: wish.priority,
    collectionId: wish.collectionId,
    targetAmount: wish.targetAmount == null ? "" : String(wish.targetAmount),
    savedAmount: String(wish.savedAmount),
    deadline: wish.deadline || "",
    countries: wish.countries.join(", "),
    cities: wish.cities.join(", "),
    startDate: wish.startDate || "",
    endDate: wish.endDate || "",
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
  const [collections, setCollections] = useState<Collection[]>([]);
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
        setCollections(data.collections);
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
    let pool = wishes.filter((w) => !w.archived);
    if (filter === "purchases") pool = pool.filter((w) => w.kind === "purchase");
    if (filter === "trips") pool = pool.filter((w) => w.kind === "trip");
    if (filter === "active") pool = pool; // already non-archived
    if (filter === "archive") pool = wishes.filter((w) => w.archived);
    const filtered = needle
      ? pool.filter((wish) => `${wish.title}\n${wish.note}\n${wish.url}`.toLowerCase().includes(needle))
      : pool;
    return [...filtered].sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
  }, [filter, needle, wishes]);

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
    const target = parseAmount(draft.targetAmount);
    const saved = parseAmount(draft.savedAmount) || 0;
    const now = Date.now();
    const existing = draft.id ? wishes.find((wish) => wish.id === draft.id) : undefined;
    const order = existing?.order ?? (wishes.length ? Math.min(...wishes.map((wish) => wish.order)) - 1 : 0);
    const wish: Wish = {
      id: draft.id ?? crypto.randomUUID(),
      kind: draft.kind,
      title: title.slice(0, 180),
      price,
      currency: draft.currency,
      note: draft.note.trim().slice(0, 500),
      url: canonicalUrl(draft.url),
      image: draft.image,
      priceAuto: draft.priceAuto && price != null,
      archived: draft.archived,
      order,
      collectionId: draft.collectionId,
      priority: draft.priority,
      targetAmount: target,
      savedAmount: Math.max(0, saved),
      deadline: draft.deadline || null,
      savingsHistory: existing?.savingsHistory || [],
      countries: draft.countries.split(",").map((s) => s.trim()).filter(Boolean),
      cities: draft.cities.split(",").map((s) => s.trim()).filter(Boolean),
      startDate: draft.startDate || null,
      endDate: draft.endDate || null,
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
    const blob = new Blob([JSON.stringify(buildBackup(name, wishes, collections), null, 2)], { type: "application/json" });
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
        setOverlay({ kind: "import", name: parsed.name, wishes: parsed.wishes, collections: parsed.collections });
      } catch {
        toast.error("Файл не читается");
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport(nextName: string | null, nextWishes: Wish[], nextCollections: Collection[]) {
    const previous = { name, wishes, collections };
    if (nextName?.trim()) {
      setName(nextName.trim());
      setNameDraft(nextName.trim());
    }
    setWishes(nextWishes);
    setCollections(nextCollections);
    setOverlay(null);
    try {
      await replaceWishlist(nextName, nextWishes, nextCollections);
      toast.success("Список заменён копией");
    } catch {
      setName(previous.name);
      setWishes(previous.wishes);
      setCollections(previous.collections);
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
              <FilterPill pressed={filter === "all"} onClick={() => setFilter("all")} label={`Все (${wishes.filter(w => !w.archived).length})`} />
              <FilterPill pressed={filter === "purchases"} onClick={() => setFilter("purchases")} label={`Покупки (${wishes.filter(w => w.kind === "purchase" && !w.archived).length})`} />
              <FilterPill pressed={filter === "trips"} onClick={() => setFilter("trips")} label={`Поездки (${wishes.filter(w => w.kind === "trip" && !w.archived).length})`} />
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
                onOpen={(wish) => setOverlay({ kind: "view", wish })}
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
            onOpen={(wish) => setOverlay({ kind: "view", wish })}
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

        {screen === "map" ? (
          <div className="p-4">
            <h1 className="mb-4 text-2xl font-semibold">Карта желаний</h1>
            <CosmicMap
              wishes={wishes.filter((w) => !w.archived)}
              collections={collections}
              onOpen={(wish) => setOverlay({ kind: "view", wish })}
            />
          </div>
        ) : null}
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
          <DockButton current={false} label="Карта" icon={<Bookmark className="size-5" />} onClick={() => setScreen("map")} />
          <DockButton current={false} label="Подборки" icon={<Bookmark className="size-5" />} onClick={() => setScreen("collections")} />
          <DockButton current={false} label="Архив" icon={<Archive className="size-5" />} onClick={() => setScreen("archive")} />
          <DockButton current={false} label="Копии" icon={<ArrowUpDown className="size-5" />} onClick={() => setScreen("backups")} />
        </nav>
      ) : null}

      {overlay?.kind === "view" ? (
        <ViewSheet
          wish={overlay.wish}
          onClose={() => setOverlay(null)}
          onEdit={() => setOverlay({ kind: "edit", draft: draftFromWish(overlay.wish) })}
          onUpdate={(updated) => {
            setWishes((curr) => curr.map((w) => (w.id === updated.id ? updated : w)));
            setOverlay({ kind: "view", wish: updated });
            void putWish(updated);
          }}
        />
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

function CosmicMap({
  wishes,
  collections,
  onOpen,
}: {
  wishes: Wish[];
  collections: Collection[];
  onOpen: (w: Wish) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem("wishlist-map-view");
      if (saved) return JSON.parse(saved) as { x: number; y: number; scale: number };
    } catch {}
    return { x: 0, y: 0, scale: 1 };
  });
  const [selected, setSelected] = useState<Wish | null>(null);
  const [mode, setMode] = useState<"all" | "purchases" | "trips" | "priority" | "collections" | "savings">("all");
  const [search, setSearch] = useState("");
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastDist = useRef(0);
  const anim = useRef(0);

  const filtered = useMemo(() => {
    let list = wishes;
    if (mode === "purchases") list = list.filter((w) => w.kind === "purchase");
    if (mode === "trips") list = list.filter((w) => w.kind === "trip");
    if (mode === "priority") list = list.filter((w) => w.priority === "high" || w.priority === "critical");
    if (mode === "savings") list = list.filter((w) => w.targetAmount != null && w.savedAmount > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((w) => w.title.toLowerCase().includes(q) || w.note.toLowerCase().includes(q));
    }
    return list;
  }, [wishes, mode, search]);

  // Simple cluster layout: groups by collectionId
  const positions = useMemo(() => {
    const groups = new Map<string | null, Wish[]>();
    filtered.forEach((w) => {
      const key = w.collectionId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(w);
    });
    const pos = new Map<string, { x: number; y: number; size: number }>();
    let gi = 0;
    groups.forEach((list, cid) => {
      const cx = Math.cos(gi * 1.7) * (180 + gi * 40);
      const cy = Math.sin(gi * 1.7) * (180 + gi * 40);
      list.forEach((w, i) => {
        const ang = (i / Math.max(list.length, 1)) * Math.PI * 2;
        const r = 40 + i * 18;
        const size = 70 + (w.priority === "critical" ? 40 : w.priority === "high" ? 24 : 0) + (w.savedAmount > 0 ? 10 : 0);
        pos.set(w.id, { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, size });
      });
      gi++;
    });
    return pos;
  }, [filtered]);

  useEffect(() => {
    localStorage.setItem("wishlist-map-view", JSON.stringify(view));
  }, [view]);

  // Background stars canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      // Stars
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const r = Math.random() * 1.4 + 0.3;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Soft nebulae
      const g1 = ctx.createRadialGradient(width * 0.3, height * 0.4, 0, width * 0.3, height * 0.4, 180);
      g1.addColorStop(0, "rgba(120,80,180,0.18)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);
      const g2 = ctx.createRadialGradient(width * 0.7, height * 0.6, 0, width * 0.7, height * 0.6, 220);
      g2.addColorStop(0, "rgba(80,120,200,0.12)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function applyTransform(v = view) {
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
    }
  }

  useEffect(() => {
    applyTransform();
  }, [view]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: 0, y: 0 };
      cancelAnimationFrame(anim.current);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      lastDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1 && dragging.current) {
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: dx, y: dy };
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastDist.current > 0) {
        const factor = dist / lastDist.current;
        setView((v) => ({ ...v, scale: Math.min(3, Math.max(0.3, v.scale * factor)) }));
      }
      lastDist.current = dist;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      dragging.current = false;
      // inertia
      const step = () => {
        velocity.current.x *= 0.92;
        velocity.current.y *= 0.92;
        if (Math.abs(velocity.current.x) < 0.5 && Math.abs(velocity.current.y) < 0.5) return;
        setView((v) => ({ ...v, x: v.x + velocity.current.x, y: v.y + velocity.current.y }));
        anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    } else if (pointers.current.size === 1) {
      const remaining = [...pointers.current.values()][0];
      last.current = remaining;
      lastDist.current = 0;
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setView((v) => ({ ...v, scale: Math.min(3, Math.max(0.3, v.scale * factor)) }));
  }

  function onPlanetClick(wish: Wish, e: React.MouseEvent) {
    e.stopPropagation();
    if (Math.abs(velocity.current.x) > 2 || Math.abs(velocity.current.y) > 2) return;
    setSelected(wish);
  }

  const placeholder = (w: Wish) => (w.kind === "trip" ? "/placeholder-trip.svg" : "/placeholder-purchase.svg");

  return (
    <div className="relative flex h-[calc(100dvh-140px)] flex-col overflow-hidden rounded-2xl" style={{ background: "#07040e" }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative z-10 flex gap-2 overflow-x-auto p-2 text-xs">
        {(["all", "purchases", "trips", "priority", "savings"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-full px-3 py-1 ${mode === m ? "bg-white text-black" : "bg-white/10 text-white"}`}
            onClick={() => setMode(m)}
          >
            {m === "all" ? "Все" : m === "purchases" ? "Покупки" : m === "trips" ? "Поездки" : m === "priority" ? "Приоритет" : "Накопления"}
          </button>
        ))}
        <input
          className="ml-auto rounded-full bg-white/10 px-3 py-1 text-white placeholder:text-white/50"
          placeholder="Поиск"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          ref={worldRef}
          className="absolute left-1/2 top-1/2 origin-center"
          style={{ willChange: "transform" }}
        >
          {filtered.map((wish) => {
            const p = positions.get(wish.id);
            if (!p) return null;
            const prog = wish.targetAmount && wish.targetAmount > 0 ? Math.min(100, (wish.savedAmount / wish.targetAmount) * 100) : 0;
            return (
              <button
                key={wish.id}
                type="button"
                className="absolute flex flex-col items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/40 backdrop-blur-md"
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.size,
                  height: p.size,
                  transform: "translate(-50%, -50%)",
                  boxShadow: wish.priority === "critical" ? "0 0 20px rgba(255,120,80,0.6)" : wish.priority === "high" ? "0 0 14px rgba(180,140,255,0.45)" : "0 0 8px rgba(255,255,255,0.15)",
                }}
                onClick={(e) => onPlanetClick(wish, e)}
              >
                <img
                  src={wish.image || placeholder(wish)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                  onError={(ev) => { (ev.target as HTMLImageElement).src = placeholder(wish); }}
                />
                <div className="relative z-10 px-1 text-center text-[10px] leading-tight text-white drop-shadow">
                  <div className="font-medium">{wish.title.slice(0, 16)}</div>
                  {wish.price != null && <div>{formatMoney(wish.price, wish.currency)}</div>}
                  {prog > 0 && <div className="mt-0.5 h-1 overflow-hidden rounded bg-white/30"><div className="h-full bg-white" style={{ width: `${prog}%` }} /></div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl bg-black/70 p-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong>{selected.title}</strong>
              <div className="text-xs text-white/70">{selected.kind === "trip" ? "Поездка" : "Покупка"} · {selected.priority}</div>
              {selected.price != null && <div className="text-sm">{formatMoney(selected.price, selected.currency)}</div>}
              {selected.targetAmount != null && (
                <div className="text-xs">Накоплено {formatMoney(selected.savedAmount, selected.currency)} / {formatMoney(selected.targetAmount, selected.currency)}</div>
              )}
            </div>
            <button type="button" className="icon-btn" onClick={() => setSelected(null)}><X className="size-4" /></button>
          </div>
          <button type="button" className="mt-2 w-full rounded-xl bg-white py-2 text-sm text-black" onClick={() => { onOpen(selected); setSelected(null); }}>
            Открыть
          </button>
        </div>
      )}
    </div>
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

function ViewSheet({
  wish,
  onClose,
  onEdit,
  onUpdate,
}: {
  wish: Wish;
  onClose: () => void;
  onEdit: () => void;
  onUpdate: (wish: Wish) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const placeholder = wish.kind === "trip" ? "/placeholder-trip.svg" : "/placeholder-purchase.svg";
  const progress = wish.targetAmount && wish.targetAmount > 0 ? Math.min(100, Math.round((wish.savedAmount / wish.targetAmount) * 100)) : 0;
  const remaining = wish.targetAmount ? Math.max(0, wish.targetAmount - wish.savedAmount) : null;

  function addSaving() {
    const val = parseAmount(amount);
    if (!val || val <= 0) {
      toast.error("Введите сумму");
      return;
    }
    const op = { id: crypto.randomUUID(), date: Date.now(), amount: val, comment: comment.trim() || undefined };
    const next: Wish = {
      ...wish,
      savedAmount: wish.savedAmount + val,
      savingsHistory: [...wish.savingsHistory, op],
      updatedAt: Date.now(),
    };
    onUpdate(next);
    setAdding(false);
    setAmount("");
    setComment("");
    toast.success("Добавили накопление");
  }

  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true" style={{ maxHeight: "90dvh", overflow: "auto" }}>
        <div className="mb-2 flex items-start justify-between gap-3">
          <button type="button" className="icon-btn" onClick={onClose}><ChevronLeft className="size-5" /></button>
          <h2 className="text-xl font-semibold">Хотелка</h2>
          <button type="button" className="icon-btn" onClick={onEdit}><MoreHorizontal className="size-5" /></button>
        </div>
        <div className="relative mb-4 overflow-hidden rounded-2xl" style={{ aspectRatio: "16/9" }}>
          <img
            src={wish.image || placeholder}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = placeholder; }}
          />
        </div>
        <h1 className="text-2xl font-semibold">{wish.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="chip">{wish.kind === "trip" ? "Поездка" : "Покупка"}</span>
          <span className="chip">{wish.priority === "high" || wish.priority === "critical" ? "Высокий приоритет" : wish.priority === "medium" ? "Средний" : "Низкий"}</span>
        </div>
        {wish.price != null && <p className="mt-3 text-lg">{formatMoney(wish.price, wish.currency)}</p>}
        {wish.deadline && <p className="text-muted">Дедлайн: {wish.deadline}</p>}
        {wish.targetAmount != null && (
          <div className="mt-4 glass rounded-xl p-3">
            <div className="flex justify-between text-sm">
              <span>Накоплено {formatMoney(wish.savedAmount, wish.currency)}</span>
              <span>Осталось {remaining != null ? formatMoney(remaining, wish.currency) : "—"}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-pink-400 to-purple-400" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-right text-sm">{progress}%</p>
            {progress >= 100 && <p className="mt-1 text-center text-sm text-green-300">Цель достигнута</p>}
            {!adding ? (
              <button type="button" className="mt-2 text-sm underline" onClick={() => setAdding(true)}>Добавить сумму</button>
            ) : (
              <div className="mt-2 space-y-2">
                <input className="field" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <input className="field" placeholder="Комментарий" value={comment} onChange={(e) => setComment(e.target.value)} />
                <button type="button" className="save" onClick={addSaving}>Добавить</button>
              </div>
            )}
          </div>
        )}
        {wish.note && (
          <div className="mt-4 glass rounded-xl p-3">
            <p className="text-sm text-muted">Заметка</p>
            <p className="mt-1 whitespace-pre-wrap">{wish.note}</p>
          </div>
        )}
        {wish.kind === "trip" && (wish.countries.length || wish.cities.length) && (
          <p className="mt-2 text-muted">{[...wish.countries, ...wish.cities].join(" · ")}</p>
        )}
        <button type="button" className="save mt-6" onClick={onEdit}>
          <Check className="size-5" /> Редактировать
        </button>
      </div>
    </div>
  );
}
