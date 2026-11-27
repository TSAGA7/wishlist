import { CalendarDays, ChevronRight, MapPin, Plane, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import { kindHint, kindLabel } from "@/lib/kinds";
import type { WishKind } from "@/types/wishlist";

const OPTIONS: { kind: WishKind; icon: typeof ShoppingBag }[] = [
  { kind: "purchase", icon: ShoppingBag },
  { kind: "trip", icon: Plane },
  { kind: "venue", icon: UtensilsCrossed },
  { kind: "place", icon: MapPin },
  { kind: "event", icon: CalendarDays },
];

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
      {OPTIONS.map(({ kind, icon: Icon }) => (
        <button key={kind} type="button" className="add-option" onClick={() => onPick(kind)}>
          <span className="add-option__icon">
            <Icon />
          </span>
          <span className="add-option__copy">
            <strong>{kindLabel(kind)}</strong>
            <small>{kindHint(kind)}</small>
          </span>
          <ChevronRight className="add-option__chevron" />
        </button>
      ))}
    </div>
  );
}
