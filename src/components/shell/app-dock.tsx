import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Archive, Bookmark, Layers, Orbit, UserRound } from "lucide-react";
import type { DockTab, Screen } from "@/types/wishlist";
import { DEFAULT_DOCK_ORDER } from "@/types/wishlist";

type DockItem = { id: DockTab; label: string; icon: ReactNode };

const CATALOG: Record<DockTab, DockItem> = {
  home: { id: "home", label: "Хотелки", icon: <Bookmark className="size-5" /> },
  map: { id: "map", label: "Карта", icon: <Orbit className="size-5" /> },
  collections: { id: "collections", label: "Подборки", icon: <Layers className="size-5" /> },
  archive: { id: "archive", label: "Архив", icon: <Archive className="size-5" /> },
  cabinet: { id: "cabinet", label: "Кабинет", icon: <UserRound className="size-5" /> },
};

function resolveOrder(order?: DockTab[]): DockItem[] {
  const ids = order?.length ? order : DEFAULT_DOCK_ORDER;
  const unique: DockTab[] = ["home"];
  for (const id of ids) {
    if (id !== "home" && CATALOG[id] && !unique.includes(id)) unique.push(id);
  }
  for (const id of DEFAULT_DOCK_ORDER) {
    if (!unique.includes(id)) unique.push(id);
  }
  return unique.map((id) => CATALOG[id]);
}

export function AppDock({
  screen,
  order,
  editing = false,
  onNavigate,
  onReorder,
}: {
  screen: Screen;
  order?: DockTab[];
  editing?: boolean;
  onNavigate: (screen: Screen) => void;
  onReorder?: (order: DockTab[]) => void;
}) {
  const items = resolveOrder(order);
  const [rows, setRows] = useState(items);
  const [lifted, setLifted] = useState<string | null>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const rowsRef = useRef(rows);
  const dragging = useRef<string | null>(null);
  const moved = useRef(false);
  rowsRef.current = rows;

  const orderKey = items.map((item) => item.id).join(",");
  useEffect(() => {
    if (!dragging.current) setRows(resolveOrder(order));
  }, [orderKey, order]);

  function onLongPressStart(event: ReactPointerEvent<HTMLButtonElement>, id: DockTab) {
    if (!editing || !onReorder || id === "home") return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    dragging.current = id;
    moved.current = false;
    setLifted(id);
    const move = (ev: PointerEvent) => {
      moved.current = true;
      const list = listRef.current;
      if (!list) return;
      const next = reorderDock(rowsRef.current, id, ev.clientX, list);
      if (next === rowsRef.current) return;
      rowsRef.current = next;
      setRows(next);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      dragging.current = null;
      setLifted(null);
      if (moved.current) onReorder(rowsRef.current.map((item) => item.id));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  return (
    <nav
      ref={(node) => {
        listRef.current = node;
      }}
      className={`dock glass ${editing ? "dock-editing" : ""}`}
      aria-label="Основная навигация"
    >
      {(editing ? rows : items).map((item) => (
        <button
          key={item.id}
          type="button"
          data-dock-id={item.id}
          className={lifted === item.id ? "dock-lifted" : undefined}
          aria-current={!editing && screen === item.id ? "page" : undefined}
          aria-grabbed={editing && lifted === item.id ? true : undefined}
          disabled={editing && item.id === "home"}
          onClick={() => {
            if (editing) return;
            onNavigate(item.id);
          }}
          onPointerDown={(event) => onLongPressStart(event, item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function reorderDock(list: DockItem[], id: DockTab, clientX: number, container: HTMLElement): DockItem[] {
  const from = list.findIndex((item) => item.id === id);
  if (from < 1) return list;
  const buttons = [...container.querySelectorAll<HTMLElement>("[data-dock-id]")];
  let to = list.length - 1;
  for (let index = 1; index < buttons.length; index += 1) {
    const box = buttons[index]!.getBoundingClientRect();
    if (clientX < box.left + box.width / 2) {
      to = index;
      break;
    }
  }
  to = Math.max(1, to);
  if (to === from) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  if (!item) return list;
  next.splice(to, 0, item);
  if (next[0]?.id !== "home") return list;
  return next;
}

export function SideNav({
  screen,
  order,
  counts,
  onNavigate,
}: {
  screen: Screen;
  order?: DockTab[];
  counts: { wishes: number; archive: number; collections: number };
  onNavigate: (screen: Screen) => void;
}) {
  const items = resolveOrder(order);
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
        {items.map((item) => {
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
