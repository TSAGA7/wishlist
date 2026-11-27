import { useMemo, useState } from "react";
import { Bell, Bookmark, Plus, Search, Settings } from "lucide-react";
import { WishReorder } from "@/features/wishes/wish-card";
import { formatMoney, goodsWord, type Currency } from "@/lib/money";
import type { HomeFilter, Wish } from "@/types/wishlist";

export function HomeScreen({
  name,
  wishes,
  query,
  filter,
  onQuery,
  onFilter,
  onSettings,
  onOpen,
  onArchive,
  onDelete,
  onReorder,
  onRename,
  onAdd,
}: {
  name: string;
  wishes: Wish[];
  query: string;
  filter: HomeFilter;
  onQuery: (value: string) => void;
  onFilter: (value: HomeFilter) => void;
  onSettings: () => void;
  onOpen: (wish: Wish) => void;
  onArchive: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
  onReorder: (ids: string[]) => void;
  onRename: (name: string) => void;
  onAdd: () => void;
}) {
  const [bell, setBell] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const needle = query.trim().toLowerCase();

  const active = wishes.filter((w) => !w.archived);
  const purchases = active.filter((w) => w.kind === "purchase");
  const trips = active.filter((w) => w.kind === "trip");

  const homeItems = useMemo(() => {
    let pool = active;
    if (filter === "purchases") pool = purchases;
    if (filter === "trips") pool = trips;
    const filtered = needle
      ? pool.filter((wish) => `${wish.title}\n${wish.note}\n${wish.url}`.toLowerCase().includes(needle))
      : pool;
    return [...filtered].sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
  }, [active, filter, needle, purchases, trips]);

  const totals = useMemo(() => sumByCurrency(homeItems), [homeItems]);

  return (
    <>
      <header className="mobile-only topbar">
        <span className="brand-mark" aria-hidden="true">
          <Bookmark className="size-5" />
        </span>
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
        <button type="button" className="icon-btn" aria-label="Настройки" onClick={onSettings}>
          <Settings className="size-5" />
        </button>
      </header>

      <div className="desktop-toolbar">
        <h1>{name}</h1>
        <label className="search glass">
          <Search className="size-4 shrink-0 opacity-70" />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Поиск по хотелкам..." aria-label="Поиск" />
        </label>
        <button type="button" className="add-desktop" onClick={onAdd}>
          <Plus className="size-4" /> Добавить
        </button>
      </div>

      <div className="mobile-only">
        <label className="search glass">
          <Search className="size-4 shrink-0 opacity-70" />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Поиск по хотелкам..." aria-label="Поиск" />
        </label>
      </div>

      <section className="hero">
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            maxLength={40}
            aria-label="Название списка"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              onRename(nameDraft);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(nameDraft);
                setEditingName(false);
              }
            }}
            className="field"
          />
        ) : (
          <button
            type="button"
            className="text-left"
            onClick={() => {
              setNameDraft(name);
              setEditingName(true);
            }}
          >
            <p>{name}</p>
          </button>
        )}
        <div className="hero-sum">{totals[0] ? formatMoney(totals[0].sum, totals[0].currency) : formatMoney(0, "RUB")}</div>
        <div className="hero-meta">
          {homeItems.length} {goodsWord(homeItems.length)}
        </div>
        <div className="bars" data-idle={homeItems.every((w) => w.price == null) ? "true" : "false"} aria-hidden="true">
          {spark(homeItems).map((height, index) => (
            <span key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
      </section>

      <div className="pills" role="tablist">
        <FilterPill pressed={filter === "all"} onClick={() => onFilter("all")} label={`Все (${active.length})`} />
        <FilterPill
          pressed={filter === "purchases"}
          onClick={() => onFilter("purchases")}
          label={`Покупки (${purchases.length})`}
        />
        <FilterPill pressed={filter === "trips"} onClick={() => onFilter("trips")} label={`Поездки (${trips.length})`} />
      </div>

      {homeItems.length === 0 ? (
        <div className="empty-card glass">
          <span className="orb">
            <Bookmark className="size-6" />
          </span>
          <strong>{needle ? "Ничего не нашли" : "Пока пусто"}</strong>
          <p>{needle ? "Попробуйте другое слово" : "Вставьте ссылку — название, цена и фото подтянутся сами."}</p>
        </div>
      ) : (
        <WishReorder
          items={homeItems}
          dragEnabled={!needle}
          onOpen={onOpen}
          onArchive={onArchive}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      )}
    </>
  );
}

function FilterPill({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="pill" role="tab" aria-selected={pressed} aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );
}

function sumByCurrency(items: Wish[]) {
  const codes: Currency[] = ["RUB", "USD", "EUR"];
  return codes
    .map((code) => ({
      currency: code,
      sum: items.filter((wish) => wish.currency === code && wish.price != null).reduce((total, wish) => total + (wish.price ?? 0), 0),
      count: items.filter((wish) => wish.currency === code && wish.price != null).length,
    }))
    .filter((group) => group.count > 0)
    .sort((a, b) => b.count - a.count);
}

function spark(wishes: Wish[]): number[] {
  const values = wishes
    .map((wish) => wish.price ?? 0)
    .filter((value) => value > 0)
    .slice(0, 7);
  if (!values.length) return [28, 46, 34, 62, 40, 70, 52];
  const max = Math.max(...values);
  return values.map((value) => Math.max(18, Math.round((value / max) * 100)));
}

export function HomeFab({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="fab" aria-label="Добавить" onClick={onClick}>
      <Plus className="size-6" />
    </button>
  );
}
