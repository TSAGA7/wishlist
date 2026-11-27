import { useState } from "react";
import { Bookmark } from "lucide-react";
import { placeholderFor } from "@/services/paths";
import type { WishKind } from "@/types/wishlist";

export function Thumb({
  src,
  kind = "purchase",
  className = "thumb",
}: {
  src: string | null;
  kind?: WishKind;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} thumb-fallback`}>
        <img src={placeholderFor(kind)} alt="" className={className} />
      </span>
    );
  }
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

export function ImageFallback({
  kind,
  onRetry,
}: {
  kind: WishKind;
  onRetry?: () => void;
}) {
  return (
    <div className="image-fallback">
      <img src={placeholderFor(kind)} alt="" />
      <p>Не удалось загрузить изображение</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Обновить
        </button>
      ) : (
        <span className="muted-fallback">
          <Bookmark className="size-4" /> Заглушка
        </span>
      )}
    </div>
  );
}
