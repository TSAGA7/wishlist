import { Archive, ArchiveRestore, ChevronLeft, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Thumb } from "@/features/wishes/thumb";
import type { Wish } from "@/types/wishlist";

export function ArchiveScreen({
  items,
  onBack,
  onOpen,
  onRestore,
  onDelete,
}: {
  items: Wish[];
  onBack: () => void;
  onOpen: (wish: Wish) => void;
  onRestore: (wish: Wish) => void;
  onDelete: (wish: Wish) => void;
}) {
  return (
    <section>
      <div className="page-head mobile-only">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </button>
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
        <p>Здесь хранятся товары, которые пока не актуальны</p>
      </div>
      <p className="text-sm text-muted">В архиве: {items.length}</p>
      {items.length === 0 ? (
        <div className="empty-card glass">
          <strong>Архив пуст</strong>
          <p>Сюда попадают желания, которые пока не актуальны.</p>
        </div>
      ) : (
        <ul className="cards">
          {items.map((wish) => (
            <li key={wish.id}>
              <article className="wish glass">
                <button type="button" className="wish-copy flex items-center gap-3" onClick={() => onOpen(wish)}>
                  <span className="thumb thumb-fallback">
                    <Thumb src={wish.image} kind={wish.kind} />
                  </span>
                  <span>
                    <strong>{wish.title}</strong>
                    <span className="wish-price">
                      {wish.price == null ? "Без цены" : formatMoney(wish.price, wish.currency)}
                    </span>
                  </span>
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
