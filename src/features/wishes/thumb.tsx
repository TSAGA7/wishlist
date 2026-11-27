import { useEffect, useState } from "react";
import { getPhotoBlob } from "@/database/wishlist-db";
import { isLocalPhotoRef, placeholderFor } from "@/services/paths";
import type { WishKind } from "@/types/wishlist";

export function Thumb({
  src,
  kind = "purchase",
  className = "thumb",
  priority = false,
}: {
  src: string | null;
  kind?: WishKind;
  className?: string;
  /** When false, browser may defer loading until near viewport. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setFailed(false);
    setResolved(null);
    if (!src) return;
    if (isLocalPhotoRef(src)) {
      void getPhotoBlob(src).then((blob) => {
        if (!alive || !blob) {
          if (alive) setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      });
      return () => {
        alive = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    setResolved(src);
    return () => {
      alive = false;
    };
  }, [src]);

  if (!src || failed || !resolved) {
    return (
      <span className={`${className} thumb-fallback`}>
        <img src={placeholderFor(kind)} alt="" className={className} loading="lazy" decoding="async" />
      </span>
    );
  }

  return (
    <img
      src={resolved}
      alt=""
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function ImageFallback({
  kind = "purchase",
  onRetry,
}: {
  kind?: WishKind;
  onRetry?: () => void;
}) {
  return (
    <div className="image-fallback">
      <img src={placeholderFor(kind)} alt="" className="fallback-art" />
      <p>Не удалось загрузить изображение</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Обновить
        </button>
      ) : null}
    </div>
  );
}
