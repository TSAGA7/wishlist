import type { ReactNode } from "react";
import { Archive, ArrowUpDown, Bookmark, Layers, Orbit } from "lucide-react";
import type { Screen } from "@/types/wishlist";

const ITEMS: { id: Screen; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Хотелки", icon: <Bookmark className="size-5" /> },
  { id: "map", label: "Карта", icon: <Orbit className="size-5" /> },
  { id: "collections", label: "Подборки", icon: <Layers className="size-5" /> },
  { id: "archive", label: "Архив", icon: <Archive className="size-5" /> },
  { id: "backups", label: "Копии", icon: <ArrowUpDown className="size-5" /> },
];

export function AppDock({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const active = screen === "settings" ? "home" : screen;
  return (
    <nav className="dock glass" aria-label="Основная навигация">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function SideNav({
  screen,
  counts,
  onNavigate,
}: {
  screen: Screen;
  counts: { wishes: number; archive: number; collections: number };
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <aside className="side">
      <div className="topbar">
        <span className="brand-mark" aria-hidden="true">
          <Bookmark className="size-4" />
        </span>
        <div className="brand-copy">
          <strong>Wishlist</strong>
          <small>Мои хотелки</small>
        </div>
      </div>
      <nav>
        {ITEMS.map((item) => {
          const count =
            item.id === "home"
              ? counts.wishes
              : item.id === "archive"
                ? counts.archive
                : item.id === "collections"
                  ? counts.collections
                  : undefined;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={screen === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {count != null ? <span className="count">{count}</span> : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
