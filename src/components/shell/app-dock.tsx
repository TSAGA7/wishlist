import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Bookmark, Plus } from "lucide-react";
import { NavIcon } from "@/components/shell/nav-catalog";
import { tabLabel, visibleDock } from "@/lib/navigation";
import type { AppSettings, DockTab, Screen } from "@/types/wishlist";

function dockCurrent(screen: Screen): DockTab | null {
  if (screen === "archive") return "cabinet";
  if (screen === "home" || screen === "map" || screen === "collections" || screen === "cabinet") return screen;
  return null;
}

export function AppDock({
  screen,
  settings,
  onNavigate,
  onAdd,
  onRecoverCabinet,
}: {
  screen: Screen;
  settings: AppSettings;
  onNavigate: (screen: Screen) => void;
  onAdd: () => void;
  onRecoverCabinet?: () => void;
}) {
  const items = visibleDock(settings);
  const current = dockCurrent(screen);
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);
  const columns = `${left.map(() => "minmax(0, 1fr)").join(" ")} auto ${right.map(() => "minmax(0, 1fr)").join(" ")}`.trim();
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

  function tabButton(id: DockTab) {
    return (
      <button
        key={id}
        type="button"
        aria-current={current === id ? "page" : undefined}
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
    );
  }

  return (
    <nav className="dock" aria-label="Основная навигация" style={{ gridTemplateColumns: columns }}>
      {left.map(tabButton)}
      <button
        type="button"
        className="dock-add"
        aria-label="Добавить"
        onPointerDown={onPointerDown}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          onAdd();
        }}
      >
        <Plus className="size-6" strokeWidth={2.25} />
      </button>
      {right.map(tabButton)}
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
  const current = dockCurrent(screen);
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
          const count = id === "home" ? counts.wishes : id === "collections" ? counts.collections : undefined;
          return (
            <button key={id} type="button" aria-current={current === id ? "page" : undefined} onClick={() => onNavigate(id)}>
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
