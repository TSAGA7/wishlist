import { Archive, CheckCircle2, Trash2, X } from "lucide-react";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";

export function CompletedModal({
  title = "Желание исполнено?",
  onArchive,
  onDelete,
  onClose,
}: {
  title?: string;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <OverlayFrame onClose={onClose} variant="center">
      <CompletedCard title={title} onArchive={onArchive} onDelete={onDelete} />
    </OverlayFrame>
  );
}

function CompletedCard({
  title,
  onArchive,
  onDelete,
}: {
  title: string;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const dismiss = useOverlayClose();
  return (
    <div className="add-modal completed-modal" role="dialog" aria-modal="true" aria-labelledby="completed-title">
      <div className="add-modal__head">
        <span className="completed-modal__badge" aria-hidden="true">
          <CheckCircle2 className="size-7" />
        </span>
        <button type="button" className="add-modal__close" aria-label="Закрыть" onClick={() => dismiss?.()}>
          <X className="size-5" />
        </button>
      </div>
      <h2 id="completed-title" className="completed-modal__title">
        {title}
      </h2>
      <button type="button" className="save" onClick={onArchive}>
        <Archive className="size-4" /> В архив
      </button>
      <button type="button" className="completed-modal__delete" onClick={onDelete}>
        <Trash2 className="size-4" /> Удалить
      </button>
    </div>
  );
}
