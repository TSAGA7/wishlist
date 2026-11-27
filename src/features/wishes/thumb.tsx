import { useState } from "react";
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
  onRetry,
}: {
  kind?: WishKind;
  onRetry?: () => void;
}) {
  return (
    <div className="image-fallback">
      <svg viewBox="0 0 360 180" className="fallback-art" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2148" />
            <stop offset="100%" stopColor="#c98478" />
          </linearGradient>
        </defs>
        <rect width="360" height="180" fill="url(#sky)" />
        <path d="M0 120 C60 90 90 130 150 110 C210 90 240 140 360 100 L360 180 L0 180 Z" fill="#1a1630" opacity="0.85" />
        <path d="M40 70 L120 48" stroke="white" strokeWidth="1.4" fill="none" opacity="0.8" />
        <path d="M112 46 L124 50 L114 56 Z" fill="white" opacity="0.9" />
        <circle cx="180" cy="96" r="7" fill="none" stroke="white" strokeWidth="1.6" />
        <path d="M180 84 v6 M180 108 v6 M168 96 h6 M192 96 h6" stroke="white" strokeWidth="1.4" />
      </svg>
      <p>Не удалось загрузить изображение</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Обновить
        </button>
      ) : null}
    </div>
  );
}
