import { useMemo, useState } from "react";
import { Bell, Bookmark, CheckSquare, Plus, Search, X } from "lucide-react";
import { useDismissable } from "@/hooks/use-dismissable";
import { WishReorder } from "@/features/wishes/wish-card";
import { filterMatchesKind } from "@/lib/kinds";
import { formatMoney, type Currency } from "@/lib/money";
import type { HomeFilter, Wish } from "@/types/wishlist";

export function HomeScreen({
  name,
  wishes,
  query,
  filter,
  selectMode,
  selectedIds,
  onQuery,
  onFilter,
  onOpen,
  onEdit,
  onComplete,
  onArchive,
  onDelete,
  onReorder,
  onRename,
  onAdd,
  onSelectMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkComplete,
  onBulkArchive,
  onBulkDelete,
}: {
  name: string;
  wishes: Wish[];
  query: string;
  filter: HomeFilter;
  selectMode: boolean;
  selectedIds: Set<string>;
  onQuery: (value: string) => void;
  onFilter: (value: HomeFilter) => void;
  onOpen: (wish: Wish) => void;
  onEdit: (wish: Wish) => void;
  onComplete: (wish: Wish) => void;
  onArchive: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
  onReorder: (ids: string[]) => void;
  onRename: (name: string) => void;
  onAdd: () => void;
  onSelectMode: (value: boolean) => void;
  onToggleSelect: (wish: Wish) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkComplete: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
}) {
  const [bell, setBell] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const bellRef = useDismissable(bell, () => setBell(false));
  const needle = query.trim().toLowerCase();

  const active = wishes.filter((w) => !w.archived);
  const counts = useMemo(
    () => ({
      all: active.length,
      purchases: active.filter((w) => w.kind === "purchase").length,
      trips: active.filter((w) => w.kind === "trip").length,
      venues: active.filter((w) => w.kind === "venue").length,
      places: active.filter((w) => w.kind === "place").length,
      events: active.filter((w) => w.kind === "event").length,
    }),
    [active],
  );

  const homeItems = useMemo(() => {
    const pool = active.filter((wish) => filterMatchesKind(filter, wish.kind));
    const filtered = needle
      ? pool.filter((wish) => `${wish.title}\n${wish.note}\n${wish.url}\n${wish.location}`.toLowerCase().includes(needle))
      : pool;
    return [...filtered].sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
  }, [active, filter, needle]);

  const totals = useMemo(() => sumByCurrency(homeItems), [homeItems]);

  return (
    <>
      <header className="mobile-only topbar">
        {selectMode ? (
          <>
            <button type="button" className="text-sm font-semibold" onClick={() => onSelectMode(false)}>
              Отмена
            </button>
            <div className="brand-copy">
              <strong>Выбрано: {selectedIds.size}</strong>
            </div>
            <button type="button" className="text-sm" onClick={selectedIds.size ? onClearSelection : onSelectAll}>
              {selectedIds.size ? "Снять" : "Все"}
            </button>
          </>
        ) : (
          <>
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
                <div ref={bellRef as React.RefObject<HTMLDivElement>} className="glass menu-pop">
                  <p className="px-3 py-3 text-sm text-muted">Пока без уведомлений</p>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Множественный выбор"
              onClick={() => onSelectMode(true)}
            >
              <CheckSquare className="size-5" />
            </button>
          </>
        )}
      </header>

      <div className="desktop-toolbar">
        <h1>{name}</h1>
        <label className="search glass">
          <Search className="size-4 shrink-0 opacity-70" />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Поиск по хотелкам..." aria-label="Поиск" />
          {query ? (
            <button type="button" className="field-clear static" aria-label="Очистить" onClick={() => onQuery("")}>
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <button type="button" className="add-desktop" onClick={onAdd}>
          <Plus className="size-4" /> Добавить
        </button>
      </div>

      {!selectMode ? (
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
          <div className="hero-meta">{homeItems.length} объектов</div>
          <div className="bars" data-idle={homeItems.every((w) => w.price == null) ? "true" : "false"} aria-hidden="true">
            {spark(homeItems).map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="pills-row">
        <div className="pills" role="tablist">
          <FilterPill pressed={filter === "all"} onClick={() => onFilter("all")} label={`Все ${counts.all}`} />
          <FilterPill pressed={filter === "purchases"} onClick={() => onFilter("purchases")} label={`Покупки ${counts.purchases}`} />
          <FilterPill pressed={filter === "trips"} onClick={() => onFilter("trips")} label={`Поездки ${counts.trips}`} />
          <FilterPill pressed={filter === "venues"} onClick={() => onFilter("venues")} label={`Заведения ${counts.venues}`} />
          <FilterPill pressed={filter === "places"} onClick={() => onFilter("places")} label={`Места ${counts.places}`} />
          <FilterPill pressed={filter === "events"} onClick={() => onFilter("events")} label={`События ${counts.events}`} />
        </div>
        {!selectMode ? (
          <button
            type="button"
            className="icon-btn pills-search"
            aria-label="Поиск"
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Search className="size-5" />
          </button>
        ) : null}
      </div>

      {searchOpen && !selectMode ? (
        <label className="search glass search-reveal">
          <Search className="size-4 shrink-0 opacity-70" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Поиск по хотелкам..."
            aria-label="Поиск"
          />
          {query ? (
            <button type="button" className="field-clear static" aria-label="Очистить" onClick={() => onQuery("")}>
              <X className="size-4" />
            </button>
          ) : null}
        </label>
      ) : null}

      {homeItems.length === 0 ? (
        <div className="empty-card glass">
          <span className="orb">
            <Bookmark className="size-6" />
          </span>
          <strong>{needle ? "Ничего не нашли" : "Пока пусто"}</strong>
          <p>{needle ? "Попробуйте другое слово" : "Добавьте покупку, поездку или место — и начните копить."}</p>
        </div>
      ) : (
        <WishReorder
          items={homeItems}
          dragEnabled={!needle && !selectMode}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onOpen={onOpen}
          onEdit={onEdit}
          onComplete={onComplete}
          onArchive={onArchive}
          onDelete={onDelete}
          onToggleSelect={onToggleSelect}
          onReorder={onReorder}
        />
      )}

      {selectMode ? (
        <div className="bulk-bar glass">
          <button type="button" disabled={!selectedIds.size} onClick={onBulkComplete}>
            Исполнено
          </button>
          <button type="button" disabled={!selectedIds.size} onClick={onBulkArchive}>
            В архив
          </button>
          <button type="button" className="bulk-danger" disabled={!selectedIds.size} onClick={onBulkDelete}>
            Удалить
          </button>
        </div>
      ) : null}
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
