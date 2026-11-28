import { useCallback, useEffect, useState } from "react";
import { getPhotoBlob } from "@/database/wishlist-db";
import { isLocalPhotoRef } from "@/services/paths";

export type WishImagePhase = "empty" | "loading" | "ready" | "error";

const LOAD_TIMEOUT_MS = 12000;

/**
 * One image source for the wish card and the cosmic map.
 * Local photos are read back from IndexedDB as Blobs. Remote URLs stay untouched;
 * a retry only adds a cache-busting query to the element, never to stored data.
 */
export function useWishImage(src: string | null | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<WishImagePhase>(src?.trim() ? "loading" : "empty");
  const [url, setUrl] = useState<string | null>(null);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const onLoad = useCallback(() => {
    setPhase("ready");
  }, []);

  const onError = useCallback(() => {
    setPhase("error");
  }, []);

  useEffect(() => {
    const value = src?.trim() ?? "";
    if (!value) {
      setPhase("empty");
      setUrl(null);
      return;
    }

    let alive = true;
    let objectUrl: string | null = null;
    const timer = window.setTimeout(() => {
      if (!alive) return;
      setPhase((current) => (current === "ready" ? current : "error"));
    }, LOAD_TIMEOUT_MS);

    setPhase("loading");
    setUrl(null);

    const finish = (next: string) => {
      if (!alive) return;
      setUrl(next);
    };

    const fail = () => {
      if (!alive) return;
      window.clearTimeout(timer);
      setPhase("error");
      setUrl(null);
    };

    if (isLocalPhotoRef(value)) {
      void getPhotoBlob(value)
        .then((blob) => {
          if (!(blob instanceof Blob) || blob.size <= 0) {
            fail();
            return;
          }
          objectUrl = URL.createObjectURL(blob);
          finish(objectUrl);
        })
        .catch(fail);
    } else if (value.startsWith("data:") || value.startsWith("blob:")) {
      finish(value);
    } else {
      finish(attempt > 0 ? withReloadToken(value, attempt) : value);
    }

    return () => {
      alive = false;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, attempt]);

  return { phase, url, attempt, retry, onLoad, onError };
}

function withReloadToken(value: string, attempt: number): string {
  try {
    const url = new URL(value, window.location.href);
    url.searchParams.set("wishlist-reload", String(attempt));
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("//")) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const joiner = value.includes("?") ? "&" : "?";
    return `${value}${joiner}wishlist-reload=${attempt}`;
  }
}
