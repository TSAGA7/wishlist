import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Archive, Check, CheckCircle2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useDismissable } from "@/hooks/use-dismissable";
import { formatMoney } from "@/lib/money";
import { kindLabel } from "@/lib/kinds";
import { Thumb } from "@/features/wishes/thumb";
import type { Wish } from "@/types/wishlist";

export function WishCard({
  wish,
  lifted,
  selected,
  selectMode,
  onOpen,
  onEdit,
  onComplete,
  onArchive,
  onDelete,
  onToggleSelect,
  onGripDown,
  priority = false,
}: {
  wish: Wish;
  lifted?: boolean;
  selected?: boolean;
  selectMode?: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleSelect?: () => void;
  onGripDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  priority?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useDismissable(menu, () => setMenu(false));
  const goal = wish.price ?? wish.targetAmount;
  const showSavings = wish.savingsEnabled && goal != null && goal > 0;
  const progress = showSavings ? Math.min(100, Math.round((wish.savedAmount / goal) * 100)) : 0;

  useLayoutEffect(() => {
    if (!menu || !triggerRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const box = triggerRef.current?.getBoundingClientRect();
      if (!box) return;
      const width = 184;
      const left = Math.min(Math.max(8, box.right - width), window.innerWidth - width - 8);
      const top = Math.min(box.bottom + 6, window.innerHeight - 220);
      setMenuPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menu]);

  return (
    <article
      className={`wish glass ${lifted ? "lifted" : ""} ${selected ? "wish-selected" : ""}`}
      onClick={() => {
        if (selectMode) onToggleSelect?.();
        else onOpen();
      }}
    >
      {selectMode ? (
        <button
          type="button"
          className={`wish-check ${selected ? "is-on" : ""}`}
          aria-pressed={selected}
          aria-label={selected ? "Снять выделение" : "Выбрать"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect?.();
          }}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>
      ) : null}
      <button
        type="button"
        className="thumb-fallback thumb touch-none"
        aria-label="Перетащить"
        onPointerDown={(event) => {
          event.stopPropagation();
          onGripDown?.(event);
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <Thumb src={wish.image} kind={wish.kind} priority={priority} />
      </button>
      <div className="wish-copy">
        <strong>{wish.title}</strong>
        <span className="wish-price">
          {wish.price == null ? "Без цены" : formatMoney(wish.price, wish.currency)}
          <span className="badge">{kindLabel(wish.kind)}</span>
        </span>
        {showSavings ? (
          <span className="wish-progress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </div>
      {!selectMode ? (
        <div className="relative" onClick={(event) => event.stopPropagation()}>
          <button
            ref={triggerRef}
            type="button"
            className="icon-btn"
            aria-label="Действия"
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
          >
            <MoreHorizontal className="size-5" />
          </button>
          {menu && menuPos
            ? createPortal(
                <div
                  ref={menuRef as React.RefObject<HTMLDivElement>}
                  className="glass pop pop-portal"
                  role="menu"
                  style={{ top: menuPos.top, left: menuPos.left }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onEdit();
                    }}
                  >
                    <Pencil className="size-4" /> Редактировать
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onComplete();
                    }}
                  >
                    <CheckCircle2 className="size-4" /> Исполнено
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onArchive();
                    }}
                  >
                    <Archive className="size-4" /> В архив
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="text-danger"
                    onClick={() => {
                      setMenu(false);
                      onDelete();
                    }}
                  >
                    <Trash2 className="size-4" /> Удалить
                  </button>
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : null}
    </article>
  );
}

export function WishReorder({
  items,
  dragEnabled,
  selectMode,
  selectedIds,
  onOpen,
  onEdit,
  onComplete,
  onArchive,
  onDelete,
  onToggleSelect,
  onReorder,
}: {
  items: Wish[];
  dragEnabled: boolean;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onOpen: (wish: Wish) => void;
  onEdit: (wish: Wish) => void;
  onComplete: (wish: Wish) => void;
  onArchive: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
  onToggleSelect?: (wish: Wish) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [rows, setRows] = useState(items);
  const [lifted, setLifted] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rowsRef = useRef(rows);
  const dragging = useRef<string | null>(null);
  rowsRef.current = rows;

  useEffect(() => {
    if (!dragging.current) setRows(items);
  }, [items]);

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (!dragEnabled || selectMode) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    dragging.current = id;
    setLifted(id);
    let lastY = event.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - lastY) < 14 && Math.abs(ev.clientX - event.clientX) < 14) return;
      const list = listRef.current;
      if (!list) return;
      const next = reorderByPointer(rowsRef.current, id, ev.clientX, ev.clientY, list);
      if (next === rowsRef.current) return;
      lastY = ev.clientY;
      rowsRef.current = next;
      setRows(next);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      dragging.current = null;
      setLifted(null);
      onReorder(rowsRef.current.map((wish) => wish.id));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  return (
    <ul ref={listRef} className="cards poster">
      {rows.map((wish, index) => (
        <li
          key={wish.id}
          data-wish-id={wish.id}
          className="card-in relative"
          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        >
          <WishCard
            wish={wish}
            lifted={lifted === wish.id}
            selectMode={selectMode}
            selected={selectedIds?.has(wish.id)}
            priority={index < 4}
            onOpen={() => onOpen(wish)}
            onEdit={() => onEdit(wish)}
            onComplete={() => onComplete(wish)}
            onArchive={() => onArchive(wish)}
            onDelete={() => onDelete(wish)}
            onToggleSelect={() => onToggleSelect?.(wish)}
            onGripDown={(event) => onGripDown(event, wish.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function reorderByPointer(list: Wish[], id: string, clientX: number, clientY: number, container: HTMLElement): Wish[] {
  const from = list.findIndex((wish) => wish.id === id);
  if (from < 0) return list;
  const cards = [...container.querySelectorAll<HTMLElement>("[data-wish-id]")];
  let to = list.length - 1;
  for (let index = 0; index < cards.length; index += 1) {
    const box = cards[index]!.getBoundingClientRect();
    const midY = box.top + box.height / 2;
    const midX = box.left + box.width / 2;
    const sameRow = Math.abs(clientY - midY) <= box.height / 2;
    if (clientY < midY - 4 || (sameRow && clientX < midX)) {
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
