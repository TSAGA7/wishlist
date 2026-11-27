import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Thumb } from "@/features/wishes/thumb";
import type { Wish } from "@/types/wishlist";

export function WishCard({
  wish,
  lifted,
  onOpen,
  onArchive,
  onDelete,
  onGripDown,
  archivedView = false,
}: {
  wish: Wish;
  lifted?: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onGripDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  archivedView?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <article className={`wish glass ${lifted ? "lifted" : ""}`}>
      <button
        type="button"
        className="thumb-fallback thumb touch-none"
        aria-label="Перетащить"
        onPointerDown={onGripDown}
        onClick={(event) => event.stopPropagation()}
      >
        <Thumb src={wish.image} kind={wish.kind} />
      </button>
      <button type="button" className="wish-copy" onClick={onOpen}>
        <strong>{wish.title}</strong>
        <span className="wish-price">
          {wish.price == null ? "Без цены" : formatMoney(wish.price, wish.currency)}
          <span className="badge">{wish.kind === "trip" ? "Поездка" : "Покупка"}</span>
          {wish.priceAuto ? <span className="badge">auto</span> : null}
        </span>
      </button>
      <div className="relative">
        <button type="button" className="icon-btn" aria-label="Действия" onClick={() => setMenu((open) => !open)}>
          <MoreHorizontal className="size-5" />
        </button>
        {menu ? (
          <div className="glass pop">
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onOpen();
              }}
            >
              Открыть
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onArchive();
              }}
            >
              {archivedView || wish.archived ? "Вернуть" : "В архив"}
            </button>
            {wish.url ? (
              <a href={wish.url} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>
                Ссылка
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
            >
              Удалить
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function WishReorder({
  items,
  dragEnabled,
  onOpen,
  onArchive,
  onDelete,
  onReorder,
}: {
  items: Wish[];
  dragEnabled: boolean;
  onOpen: (wish: Wish) => void;
  onArchive: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
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
    if (!dragEnabled) return;
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
        <li key={wish.id} data-wish-id={wish.id} className="card-in relative" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
          <WishCard
            wish={wish}
            lifted={lifted === wish.id}
            onOpen={() => onOpen(wish)}
            onArchive={() => onArchive(wish)}
            onDelete={() => onDelete(wish)}
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
