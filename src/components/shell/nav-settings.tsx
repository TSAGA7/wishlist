import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, Eye, EyeOff, GripVertical, House } from "lucide-react";
import { NavIcon } from "@/components/shell/nav-catalog";
import { NAV_ITEMS, tabLabel } from "@/lib/navigation";
import type { AppSettings, DockTab } from "@/types/wishlist";

export function HomeScreenSettings({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings;
  onChange: (home: DockTab) => void;
  onClose: () => void;
}) {
  return (
    <section className="nav-settings">
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onClose}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Главный экран</h1>
        <span className="icon-btn" aria-hidden="true" />
      </div>
      <p className="nav-settings__lead">Раздел, который будет открываться при запуске приложения</p>
      <div className="nav-choice-list" role="radiogroup" aria-label="Главный экран">
        {NAV_ITEMS.map((item) => {
          const selected = settings.homeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`nav-choice ${selected ? "is-selected" : ""}`}
              onClick={() => onChange(item.id)}
            >
              <span className="nav-choice__icon" aria-hidden="true">
                <NavIcon id={item.id} />
              </span>
              <span className="nav-choice__label">{item.label}</span>
              <span className={`radio-dot ${selected ? "is-on" : ""}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <button type="button" className="save nav-settings__save" onClick={onClose}>
        Сохранить
      </button>
    </section>
  );
}

export function TabOrderSettings({
  settings,
  onOrder,
  onVisibility,
  onClose,
}: {
  settings: AppSettings;
  onOrder: (order: DockTab[]) => void;
  onVisibility: (tab: DockTab, visible: boolean) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<DockTab[]>(settings.dockOrder);
  const listRef = useRef<HTMLUListElement>(null);
  const rowsRef = useRef(rows);
  const tops = useRef(new Map<string, number>());
  const dragging = useRef<DockTab | null>(null);
  const [lifted, setLifted] = useState<DockTab | null>(null);
  rowsRef.current = rows;

  useLayoutEffect(() => {
    if (!dragging.current) setRows(settings.dockOrder);
  }, [settings.dockOrder]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map<string, number>();
    for (const node of list.querySelectorAll<HTMLElement>("[data-tab]")) {
      const id = node.dataset.tab;
      if (!id) continue;
      const top = node.getBoundingClientRect().top;
      const prev = tops.current.get(id);
      if (prev != null && Math.abs(prev - top) > 1 && id !== dragging.current) {
        node.animate(
          [{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }],
          { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      }
      next.set(id, top);
    }
    tops.current = next;
  }, [rows]);

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>, id: DockTab) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    dragging.current = id;
    setLifted(id);
    const move = (ev: PointerEvent) => {
      const list = listRef.current;
      if (!list) return;
      const next = reorderTabs(rowsRef.current, id, ev.clientY, list);
      if (next === rowsRef.current) return;
      rowsRef.current = next;
      setRows(next);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      const committed = rowsRef.current;
      dragging.current = null;
      setLifted(null);
      onOrder(committed);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  return (
    <section className="nav-settings">
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onClose}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Порядок вкладок</h1>
        <span className="icon-btn" aria-hidden="true" />
      </div>
      <p className="nav-settings__lead">Управляйте вкладками в нижней навигации</p>
      <ul ref={listRef} className="nav-order">
        {rows.map((id) => {
          const hidden = settings.dockHidden.includes(id);
          const isHome = settings.homeScreen === id;
          return (
            <li key={id} data-tab={id} className={`nav-order__row ${lifted === id ? "is-lifted" : ""} ${hidden ? "is-hidden" : ""}`}>
              <button
                type="button"
                className="nav-order__grip"
                aria-label={`Перетащить «${tabLabel(id)}»`}
                onPointerDown={(event) => onGripDown(event, id)}
              >
                <GripVertical className="size-5" />
              </button>
              <span className="nav-choice__icon" aria-hidden="true">
                <NavIcon id={id} />
              </span>
              <span className="nav-order__label">{tabLabel(id)}</span>
              {isHome ? (
                <span className="nav-order__home" title="Главный экран">
                  <House className="size-3.5" />
                </span>
              ) : null}
              <button
                type="button"
                className={`nav-order__eye ${hidden ? "is-off" : ""}`}
                aria-pressed={!hidden}
                aria-label={hidden ? `Показать «${tabLabel(id)}»` : `Скрыть «${tabLabel(id)}»`}
                onClick={() => onVisibility(id, hidden)}
              >
                {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="nav-settings__hint">
        Перетаскивайте строки, чтобы изменить порядок. Нажмите на глаз, чтобы скрыть вкладку — её можно вернуть позже.
        Домик отмечает главный экран: он не зависит от позиции в списке.
      </p>
      <button type="button" className="save nav-settings__save" onClick={onClose}>
        Сохранить
      </button>
    </section>
  );
}

function reorderTabs(list: DockTab[], id: DockTab, clientY: number, container: HTMLElement): DockTab[] {
  const from = list.indexOf(id);
  if (from < 0) return list;
  const rows = [...container.querySelectorAll<HTMLElement>("[data-tab]")];
  let to = list.length - 1;
  for (let index = 0; index < rows.length; index += 1) {
    const box = rows[index]!.getBoundingClientRect();
    if (clientY < box.top + box.height / 2) {
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
