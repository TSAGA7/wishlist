import { Plane, ShoppingBag, X } from "lucide-react";
import type { WishKind } from "@/types/wishlist";

export function AddChoiceSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (kind: WishKind) => void;
}) {
  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true" aria-labelledby="add-choice-title">
        <div className="handle" />
        <div className="mb-3 flex items-center justify-between">
          <h2 id="add-choice-title" className="text-xl font-semibold">
            Что добавить?
          </h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="choice-grid">
          <button type="button" className="choice-card glass" onClick={() => onPick("purchase")}>
            <span className="choice-icon">
              <ShoppingBag className="size-6" />
            </span>
            <strong>Покупка</strong>
            <p>Товар, гаджет, одежда и т.д.</p>
          </button>
          <button type="button" className="choice-card glass" onClick={() => onPick("trip")}>
            <span className="choice-icon">
              <Plane className="size-6" />
            </span>
            <strong>Поездка</strong>
            <p>Путешествие, маршрут, места.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
