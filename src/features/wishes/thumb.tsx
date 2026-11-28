import { placeholderFor } from "@/services/paths";
import { useWishImage } from "@/features/wishes/use-wish-image";
import type { WishKind } from "@/types/wishlist";

export function Thumb({
  src,
  kind = "purchase",
  className = "thumb",
  priority = false,
  frame = "thumb",
}: {
  src: string | null;
  kind?: WishKind;
  className?: string;
  /** When false, browser may defer loading until near viewport. */
  priority?: boolean;
  /** `cover` fills a photo frame and offers a retry. `thumb` stays a small preview. */
  frame?: "thumb" | "cover";
}) {
  const image = useWishImage(src);
  const placeholder = placeholderFor(kind);

  if (!src || image.phase === "empty") {
    return <img src={placeholder} alt="" className={frame === "cover" ? "photo-stage__img" : className} loading="lazy" decoding="async" />;
  }

  if (image.phase === "loading" && !image.url) {
    return (
      <span className={frame === "cover" ? "photo-stage" : `${className} thumb-fallback`}>
        <span className="photo-spinner" aria-hidden="true" />
      </span>
    );
  }

  if (image.phase === "error" || !image.url) {
    return frame === "cover" ? (
      <ImageFallback kind={kind} onRetry={image.retry} />
    ) : (
      <img src={placeholder} alt="" className={className} loading="lazy" decoding="async" />
    );
  }

  if (frame === "thumb") {
    return (
      <img
        key={image.attempt}
        src={image.url}
        alt=""
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={image.onLoad}
        onError={image.onError}
      />
    );
  }

  return (
    <span className="photo-stage">
      {image.phase === "loading" ? <span className="photo-spinner" aria-hidden="true" /> : null}
      <img
        key={image.attempt}
        src={image.url}
        alt=""
        className="photo-stage__img"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={image.onLoad}
        onError={image.onError}
      />
    </span>
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
