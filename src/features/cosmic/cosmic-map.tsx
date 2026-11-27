import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { computePlanetLayout, fitMapView } from "@/features/cosmic/layout";
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
  onPersistPositions,
}: {
  wishes: Wish[];
  collections: Collection[];
  onOpen: (wish: Wish) => void;
  onSettings?: () => void;
  onPersistPositions?: (updates: Array<{ id: string; mapX: number; mapY: number }>) => void;
}) {
  const [filter, setFilter] = useState<MapFilter>("all");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<Wish | null>(null);
  const persisted = useRef(new Set<string>());
  const fitted = useRef(false);
  const persistRef = useRef(onPersistPositions);
  persistRef.current = onPersistPositions;
  const { view, setView, onPointerDown, onPointerMove, onPointerUp, onWheel, wasDrag } = useMapViewport();

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
    if (fitted.current || !positions.size) return;
    if (localStorage.getItem("wishlist-map-view")) {
      fitted.current = true;
      return;
    }
    setView(fitMapView(positions));
    fitted.current = true;
  }, [positions, setView]);

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
        <div className="cosmic-brand">
          <span className="brand-mark" aria-hidden="true">
            <Bookmark className="size-4" />
          </span>
          <div>
            <strong>Wishlist</strong>
            <small>Карта желаний</small>
          </div>
        </div>
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
          <svg className="cosmic-lines" aria-hidden="true">
            {lines.map((ln, i) => (
              <g key={i}>
                <line
                  x1={ln.x1 + 2500}
                  y1={ln.y1 + 2500}
                  x2={ln.x2 + 2500}
                  y2={ln.y2 + 2500}
                  stroke={ln.color}
                  strokeWidth="1.6"
                  strokeDasharray="4 6"
                  opacity="0.65"
                />
                <circle cx={(ln.x1 + ln.x2) / 2 + 2500} cy={(ln.y1 + ln.y2) / 2 + 2500} r="2.2" fill={ln.color} />
              </g>
            ))}
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
