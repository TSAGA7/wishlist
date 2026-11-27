import { ChevronRight, Plane, ShoppingBag, X } from "lucide-react";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import type { WishKind } from "@/types/wishlist";

export function AddChoiceSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (kind: WishKind) => void;
}) {
  return (
    <OverlayFrame onClose={onClose} variant="center">
      <AddChoiceCard onPick={onPick} />
    </OverlayFrame>
  );
}

function AddChoiceCard({ onPick }: { onPick: (kind: WishKind) => void }) {
  const dismiss = useOverlayClose();
  return (
    <div className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-choice-title">
      <div className="add-modal__head">
        <h2 id="add-choice-title">Что добавить?</h2>
        <button type="button" className="add-modal__close" aria-label="Закрыть" onClick={() => dismiss?.()}>
          <X className="size-5" />
        </button>
      </div>
      <button type="button" className="add-option" onClick={() => onPick("purchase")}>
        <span className="add-option__icon">
          <ShoppingBag />
        </span>
        <span className="add-option__copy">
          <strong>Покупка</strong>
          <small>Товар, гаджет, одежда и т.д.</small>
        </span>
        <ChevronRight className="add-option__chevron" />
      </button>
      <button type="button" className="add-option" onClick={() => onPick("trip")}>
        <span className="add-option__icon">
          <Plane />
        </span>
        <span className="add-option__copy">
          <strong>Поездка</strong>
          <small>Путешествие, маршрут, места</small>
        </span>
        <ChevronRight className="add-option__chevron" />
      </button>
    </div>
  );
}
