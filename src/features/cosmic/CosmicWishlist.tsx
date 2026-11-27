import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bookmark,
  CalendarDays,
  Compass,
  Plane,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMapViewport } from "@/features/cosmic/use-map-viewport";
import "./cosmic-wishlist.css";

export type CosmicWish = {
  id: string;
  title: string;
  kind: "purchase" | "trip";
  image?: string | null;
  price?: number | null;
  currency?: string;
  priority?: string;
  savedAmount?: number;
  targetAmount?: number | null;
  deadline?: string | null;
  subtitle?: string;
  x: number;
  y: number;
  size: "hero" | "satellite" | "moon";
};

export type CosmicWishlistProps = {
  wishes: CosmicWish[];
  onOpenWish: (wish: CosmicWish) => void;
  onAddWish: () => void;
  onRetryImage?: (wish: CosmicWish) => void;
  onOpenSettings?: () => void;
  subtitle?: string;
  className?: string;
  showAdd?: boolean;
};

type Filter = "all" | "purchases" | "trips" | "priority" | "savings";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "purchases", label: "Покупки" },
  { id: "trips", label: "Поездки" },
  { id: "priority", label: "Приоритет" },
  { id: "savings", label: "Накопления" },
];

function money(value?: number | null, currency = "RUB"): string {
  if (value == null || !Number.isFinite(value)) return "";
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₽";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ${symbol}`;
}

function priorityLabel(priority?: string): string {
  if (priority === "critical") return "Критический";
  if (priority === "high") return "Высокий";
  if (priority === "medium") return "Средний";
  return "";
}

function dateLabel(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric" }).format(date);
}

function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 190 }, (_, index) => ({
  id: index,
  x: seeded(index + 1) * 100,
  y: seeded(index + 501) * 100,
  size: 1 + seeded(index + 901) * 2,
  opacity: 0.22 + seeded(index + 1301) * 0.7,
  delay: `${seeded(index + 1701) * 7}s`,
}));

function Stars() {
  return (
    <div className="cw-stars" aria-hidden="true">
      {STARS.map((star) => (
        <i
          key={star.id}
          className="cw-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}

function imageSrc(src: string, nonce: number): string {
  if (nonce === 0) return src;
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}cw=${nonce}`;
}

function Planet({
  wish,
  index,
  onOpen,
  onRetry,
}: {
  wish: CosmicWish;
  index: number;
  onOpen: (wish: CosmicWish) => void;
  onRetry?: (wish: CosmicWish) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const progress =
    wish.targetAmount && wish.targetAmount > 0
      ? Math.min(100, Math.round(((wish.savedAmount || 0) / wish.targetAmount) * 100))
      : null;
  const priority = wish.size === "moon" ? "" : priorityLabel(wish.priority);
  const source = wish.image?.trim() ? wish.image.trim() : "";
  const image = source && !failed ? imageSrc(source, nonce) : "";
  const showProgress = wish.size !== "moon" && progress != null && (wish.size === "hero" || wish.kind === "trip");

  return (
    <div
      role="button"
      tabIndex={0}
      data-outer={wish.size === "hero" || wish.x >= 48 ? "right" : "left"}
      className={`cw-planet cw-planet--${wish.size}`}
      style={{ left: `${wish.x}%`, top: `${wish.y}%`, animationDelay: `${(index % 7) * -0.7}s` }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => onOpen(wish)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(wish);
        }
      }}
      aria-label={`Открыть желание: ${wish.title}`}
    >
      <span className="cw-sphere">
      <span className={`cw-planet__surface ${image ? "" : "is-placeholder"}`}>
        {image ? (
          <img
            src={image}
            alt=""
            draggable={false}
            loading={index > 3 ? "lazy" : "eager"}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="cw-placeholder">{wish.kind === "trip" ? <Compass /> : <ShoppingBag />}</span>
        )}
        <span className="cw-shade" />
        <span className="cw-rim" />
      </span>
      <span className="cw-type">{wish.kind === "trip" ? <Plane /> : <ShoppingBag />}</span>
      {priority ? <span className={`cw-priority cw-priority--${wish.priority}`}>{priority}</span> : null}
      {wish.size === "moon" ? null : (
        <span className="cw-copy">
          <strong>{wish.title}</strong>
          {wish.size === "hero" && wish.subtitle ? <small>{wish.subtitle}</small> : null}
          {wish.price != null ? <b>{money(wish.price, wish.currency)}</b> : null}
          {showProgress ? (
            <span className="cw-progress">
              <i>
                <em style={{ width: `${progress}%` }} />
              </i>
              <small>{progress}%</small>
            </span>
          ) : null}
          {wish.size === "hero" && wish.deadline ? (
            <small className="cw-deadline">
              <CalendarDays /> {dateLabel(wish.deadline)}
            </small>
          ) : null}
        </span>
      )}
      {failed ? (
        <button
          type="button"
          className="cw-retry"
          aria-label="Повторить загрузку изображения"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setFailed(false);
            setNonce((value) => value + 1);
            onRetry?.(wish);
          }}
        >
          ↻
        </button>
      ) : null}
      </span>
    </div>
  );
}

/** Cosmic map. The app dock stays outside this component. */
export default function CosmicWishlist({
  wishes,
  onOpenWish,
  onAddWish,
  onRetryImage,
  onOpenSettings,
  subtitle = "Карта желаний",
  className = "",
  showAdd = true,
}: CosmicWishlistProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const { view, onPointerDown, onPointerMove, onPointerUp, zoomBy, resetView, wasDrag } = useMapViewport(stageRef);

  const visible = useMemo(() => {
    let list = wishes;
    if (filter === "purchases") list = list.filter((wish) => wish.kind === "purchase");
    if (filter === "trips") list = list.filter((wish) => wish.kind === "trip");
    if (filter === "priority") list = list.filter((wish) => wish.priority === "high" || wish.priority === "critical");
    if (filter === "savings") list = list.filter((wish) => (wish.targetAmount || 0) > 0);
    const query = search.trim().toLocaleLowerCase("ru");
    return query ? list.filter((wish) => `${wish.title} ${wish.subtitle || ""}`.toLocaleLowerCase("ru").includes(query)) : list;
  }, [wishes, filter, search]);

  const worldStyle: CSSProperties = {
    transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
  };

  return (
    <main className={`cosmic-wishlist ${searchOpen ? "has-search" : ""} ${className}`.trim()}>
      <div className="cw-nebula" aria-hidden="true" />
      <Stars />
      <header className="cw-header">
        <div className="cw-brand">
          <span className="cw-brand__icon">
            <Bookmark />
          </span>
          <span>
            <strong>Wishlist</strong>
            <small>{subtitle}</small>
          </span>
        </div>
        <div className="cw-actions">
          <button type="button" aria-label="Поиск" aria-pressed={searchOpen} onClick={() => setSearchOpen((open) => !open)}>
            <Search />
          </button>
          <button
            type="button"
            aria-label="Фильтры"
            onClick={() => setFilter((current) => (current === "all" ? "priority" : "all"))}
          >
            <SlidersHorizontal />
          </button>
          <button type="button" aria-label="Настройки" onClick={onOpenSettings}>
            <Settings2 />
          </button>
        </div>
      </header>
      {searchOpen ? (
        <div className="cw-search">
          <Search />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Найти желание..."
            aria-label="Найти желание"
          />
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => {
              setSearch("");
              setSearchOpen(false);
            }}
          >
            <X />
          </button>
        </div>
      ) : null}
      <nav className="cw-filters" aria-label="Фильтры карты">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "active" : ""}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div
        ref={stageRef}
        className="cw-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="cw-world" style={worldStyle}>
          <svg className="cw-orbits" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="cw-orbit-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#ffd0ee" stopOpacity="0.08" />
                <stop offset="50%" stopColor="#f3b5ff" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#9dc8ff" stopOpacity="0.08" />
              </linearGradient>
            </defs>
            <ellipse cx="500" cy="510" rx="390" ry="255" transform="rotate(-23 500 510)" />
            <ellipse cx="500" cy="510" rx="310" ry="405" transform="rotate(28 500 510)" />
            <path d="M95 590 C240 390 340 335 500 505 S760 710 910 360" />
            <path d="M180 180 C370 285 570 230 815 205" />
          </svg>
          {visible.map((wish) => (
            <Planet
              key={wish.id}
              wish={wish}
              index={Math.max(0, wishes.findIndex((item) => item.id === wish.id))}
              onOpen={(item) => {
                if (wasDrag()) return;
                onOpenWish(item);
              }}
              onRetry={onRetryImage}
            />
          ))}
        </div>
        {!visible.length ? (
          <div className="cw-empty">
            <span>
              <Bookmark />
            </span>
            <strong>Здесь пока тихо</strong>
            <small>Добавь желание — и оно появится на твоей карте</small>
          </div>
        ) : null}
      </div>
      <div className="cw-tools">
        <div className="cw-zoom">
          <button type="button" onClick={() => zoomBy(0.9)} aria-label="Уменьшить">
            −
          </button>
          <button type="button" onClick={() => zoomBy(1.1)} aria-label="Увеличить">
            +
          </button>
          <button type="button" onClick={resetView} aria-label="Сбросить масштаб">
            <Compass />
          </button>
        </div>
        {showAdd ? (
          <button type="button" className="cw-add" onClick={onAddWish} aria-label="Добавить желание">
            <Plus />
          </button>
        ) : null}
      </div>
    </main>
  );
}
