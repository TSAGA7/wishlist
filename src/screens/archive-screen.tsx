import { Archive, ArchiveRestore, CheckCircle2, CircleDashed, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { kindLabel } from "@/lib/kinds";
import { Thumb } from "@/features/wishes/thumb";
import type { Wish } from "@/types/wishlist";

export function ArchiveScreen({
  items,
  onOpen,
  onRestore,
  onToggleCompleted,
  onDelete,
}: {
  items: Wish[];
  onOpen: (wish: Wish) => void;
  onRestore: (wish: Wish) => void;
  onToggleCompleted: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
}) {
  return (
    <section>
      <div className="page-head mobile-only">
        <span className="icon-btn" aria-hidden="true" />
        <h1>Архив</h1>
        <span className="icon-btn" aria-hidden="true">
          <Archive className="size-5" />
        </span>
      </div>
      <div className="desktop-toolbar">
        <h1>Архив</h1>
      </div>
      <div className="center-intro">
        <div className="orb glass">
          <Archive className="size-7" />
        </div>
        <h2>Архив</h2>
        <p>Исполненные и отложенные желания</p>
      </div>
      <p className="text-sm text-muted">В архиве: {items.length}</p>
      {items.length === 0 ? (
        <div className="empty-card glass">
          <strong>Архив пуст</strong>
          <p>Сюда попадают исполненные и отложенные желания.</p>
        </div>
      ) : (
        <ul className="cards">
          {items.map((wish) => (
            <li key={wish.id}>
              <article className="wish glass archive-wish">
                <button type="button" className="wish-copy flex items-center gap-3" onClick={() => onOpen(wish)}>
                  <span className="thumb thumb-fallback">
                    <Thumb src={wish.image} kind={wish.kind} />
                  </span>
                  <span>
                    <strong>{wish.title}</strong>
                    <span className="wish-price">
                      {wish.price == null ? "Без цены" : formatMoney(wish.price, wish.currency)}
                      <span className="badge">{kindLabel(wish.kind)}</span>
                    </span>
                    <span className={`archive-status ${wish.completed ? "is-done" : "is-open"}`}>
                      {wish.completed ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Исполнено
                        </>
                      ) : (
                        <>
                          <CircleDashed className="size-3.5" /> Не исполнено
                        </>
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={wish.completed ? "Отметить неисполненным" : "Отметить исполненным"}
                  onClick={() => onToggleCompleted(wish)}
                >
                  {wish.completed ? <CircleDashed className="size-5" /> : <CheckCircle2 className="size-5" />}
                </button>
                <button type="button" className="icon-btn" aria-label="Вернуть" onClick={() => onRestore(wish)}>
                  <ArchiveRestore className="size-5" />
                </button>
                <button type="button" className="icon-btn" aria-label="Удалить" onClick={() => onDelete(wish)}>
                  <Trash2 className="size-5" />
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
