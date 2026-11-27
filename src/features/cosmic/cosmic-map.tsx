import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { computePlanetLayout } from "@/features/cosmic/layout";
import { CosmicPlanet } from "@/features/cosmic/planet";
import { Starfield } from "@/features/cosmic/starfield";
import { useMapViewport } from "@/features/cosmic/use-map-viewport";
import { formatMoney } from "@/lib/money";
import type { Collection, Wish } from "@/types/wishlist";
import "@/features/cosmic/cosmic-map.css";

type MapFilter = "all" | "purchases" | "trips" | "priority" | "savings";

const FILTERS: { id: MapFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "purchases", label: "Покупки" },
  { id: "trips", label: "Поездки" },
  { id: "priority", label: "Приоритет" },
  { id: "savings", label: "Накопления" },
];

export function CosmicMap({
  wishes,
  collections,
  onOpen,
  onSettings,
  onHome,
  onPersistPositions,
}: {
  wishes: Wish[];
  collections: Collection[];
  onOpen: (wish: Wish) => void;
  onSettings?: () => void;
  onHome?: () => void;
  onPersistPositions?: (updates: Array<{ id: string; mapX: number; mapY: number }>) => void;
}) {
  const [filter, setFilter] = useState<MapFilter>("all");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Wish | null>(null);
  const persisted = useRef(new Set<string>());
  const persistRef = useRef(onPersistPositions);
  persistRef.current = onPersistPositions;
  const { view, onPointerDown, onPointerMove, onPointerUp, onWheel, wasDrag } = useMapViewport();

  const filtered = useMemo(() => {
    let list = wishes.filter((w) => !w.archived);
    if (filter === "purchases") list = list.filter((w) => w.kind === "purchase");
    if (filter === "trips") list = list.filter((w) => w.kind === "trip");
    if (filter === "priority") list = list.filter((w) => w.priority === "high" || w.priority === "critical");
    if (filter === "savings") list = list.filter((w) => (w.targetAmount ?? 0) > 0);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) =>
          w.title.toLowerCase().includes(q) ||
          w.note.toLowerCase().includes(q) ||
          w.cities.some((c) => c.toLowerCase().includes(q)) ||
          w.countries.some((c) => c.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [wishes, filter, query]);

  const { positions, lines } = useMemo(
    () => computePlanetLayout(filtered, collections),
    [filtered, collections],
  );

  useEffect(() => {
    const persist = persistRef.current;
    if (!persist) return;
    const updates: Array<{ id: string; mapX: number; mapY: number }> = [];
    for (const wish of filtered) {
      if (wish.mapX != null && wish.mapY != null) continue;
      if (persisted.current.has(wish.id)) continue;
      const pose = positions.get(wish.id);
      if (!pose) continue;
      persisted.current.add(wish.id);
      updates.push({ id: wish.id, mapX: pose.x, mapY: pose.y });
    }
    if (updates.length) persist(updates);
  }, [filtered, positions]);

  return (
    <div className="cosmic-root">
      <Starfield />

      <header className="cosmic-topbar">
        <button type="button" className="cosmic-brand" onClick={onHome}>
          <span className="brand-mark" aria-hidden="true">
            <Bookmark className="size-4" />
          </span>
          <div>
            <strong>Wishlist</strong>
            <small>Карта желаний</small>
          </div>
        </button>
        <div className="cosmic-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Поиск"
            aria-pressed={showSearch}
            onClick={() => setShowSearch((v) => !v)}
          >
            <Search className="size-5" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Фильтры"
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="size-5" />
          </button>
          {onSettings ? (
            <button type="button" className="icon-btn" aria-label="Настройки" onClick={onSettings}>
              <Settings className="size-5" />
            </button>
          ) : null}
        </div>
      </header>

      {showSearch ? (
        <label className="cosmic-search">
          <Search className="size-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по карте…"
            aria-label="Поиск по карте"
          />
        </label>
      ) : null}

      {showFilters ? (
        <div className="cosmic-filters" role="tablist">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="cosmic-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="cosmic-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <span className="cosmic-moon moon-a" aria-hidden="true" />
          <span className="cosmic-moon moon-b" aria-hidden="true" />
          <span className="cosmic-moon moon-c" aria-hidden="true" />
          <svg className="cosmic-lines" aria-hidden="true">
            {lines.map((ln, i) => {
              const x1 = ln.x1 + 2500;
              const y1 = ln.y1 + 2500;
              const x2 = ln.x2 + 2500;
              const y2 = ln.y2 + 2500;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.hypot(dx, dy) || 1;
              const bend = 36 * (i % 2 === 0 ? 1 : -1);
              const cx = mx + (-dy / len) * bend;
              const cy = my + (dx / len) * bend;
              return (
                <g key={i}>
                  <path
                    d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                    fill="none"
                    stroke={ln.color}
                    strokeWidth="1.4"
                    strokeDasharray="2 7"
                    opacity="0.8"
                  />
                  <circle cx={cx} cy={cy} r="2.4" fill="#fff" opacity="0.85" />
                </g>
              );
            })}
          </svg>
          {filtered.map((wish) => {
            const pose = positions.get(wish.id);
            if (!pose) return null;
            return (
              <CosmicPlanet
                key={wish.id}
                wish={wish}
                pose={pose}
                onOpen={(w) => {
                  if (wasDrag()) return;
                  setSelected(w);
                }}
              />
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="cosmic-empty">
            <div>
              <strong>Карта пока пуста</strong>
              <p>Добавьте хотелку — она появится как планета в созвездии.</p>
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="cosmic-sheet">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong>{selected.title}</strong>
              <div className="meta">
                {selected.kind === "trip" ? "Поездка" : "Покупка"}
                {selected.price != null ? ` · ${formatMoney(selected.price, selected.currency)}` : ""}
              </div>
            </div>
            <button type="button" className="icon-btn" aria-label="Закрыть" onClick={() => setSelected(null)}>
              <X className="size-4" />
            </button>
          </div>
          <button
            type="button"
            className="open"
            onClick={() => {
              onOpen(selected);
              setSelected(null);
            }}
          >
            Открыть
          </button>
        </div>
      ) : null}
    </div>
  );
}
