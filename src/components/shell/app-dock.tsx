import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Bookmark } from "lucide-react";
import { NavIcon } from "@/components/shell/nav-catalog";
import { tabLabel, visibleDock } from "@/lib/navigation";
import type { AppSettings, Screen } from "@/types/wishlist";

export function AppDock({
  screen,
  settings,
  onNavigate,
  onRecoverCabinet,
}: {
  screen: Screen;
  settings: AppSettings;
  onNavigate: (screen: Screen) => void;
  onRecoverCabinet?: () => void;
}) {
  const items = visibleDock(settings);
  const held = useRef(false);
  const timer = useRef<number | null>(null);

  function clearHold() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!onRecoverCabinet) return;
    held.current = false;
    clearHold();
    timer.current = window.setTimeout(() => {
      held.current = true;
      onRecoverCabinet();
    }, 650);
    const end = () => {
      clearHold();
      event.currentTarget.removeEventListener("pointerup", end);
      event.currentTarget.removeEventListener("pointercancel", end);
    };
    event.currentTarget.addEventListener("pointerup", end);
    event.currentTarget.addEventListener("pointercancel", end);
  }

  return (
    <nav className="dock" aria-label="Основная навигация" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((id) => (
        <button
          key={id}
          type="button"
          aria-current={screen === id ? "page" : undefined}
          onPointerDown={onPointerDown}
          onClick={() => {
            if (held.current) {
              held.current = false;
              return;
            }
            onNavigate(id);
          }}
        >
          <NavIcon id={id} />
          <span>{tabLabel(id)}</span>
        </button>
      ))}
    </nav>
  );
}

export function SideNav({
  screen,
  settings,
  counts,
  onNavigate,
}: {
  screen: Screen;
  settings: AppSettings;
  counts: { wishes: number; archive: number; collections: number };
  onNavigate: (screen: Screen) => void;
}) {
  const items = visibleDock(settings);
  return (
    <aside className="side">
      <div className="topbar">
        <span className="brand-mark" aria-hidden="true">
          <Bookmark className="size-4" />
        </span>
        <div className="brand-copy">
          <strong>Wishlist</strong>
          <small>Покупки, поездки и подборки</small>
        </div>
      </div>
      <nav>
        {items.map((id) => {
          const count =
            id === "home" ? counts.wishes : id === "archive" ? counts.archive : id === "collections" ? counts.collections : undefined;
          return (
            <button key={id} type="button" aria-current={screen === id ? "page" : undefined} onClick={() => onNavigate(id)}>
              <NavIcon id={id} />
              <span>{tabLabel(id)}</span>
              {count != null ? <span className="count">{count}</span> : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
