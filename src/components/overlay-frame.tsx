import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const CloseContext = createContext<(() => void) | null>(null);

export function useOverlayClose(): (() => void) | null {
  return useContext(CloseContext);
}

/**
 * Full-screen layer above the app. Pointer events stay here, the page
 * underneath does not scroll, and Escape or the system Back button can close it.
 */
export function OverlayFrame({
  children,
  onClose,
  variant,
}: {
  children: ReactNode;
  onClose: () => void;
  variant: "screen" | "center" | "sheet";
}) {
  const [leaving, setLeaving] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closing = useRef(false);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    window.setTimeout(() => onCloseRef.current(), 190);
  }, []);

  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.overflow = previous.overflow;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKey);
    };
  }, [requestClose]);

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return createPortal(
    <CloseContext.Provider value={requestClose}>
      <div
        className={`overlay-frame overlay-frame--${variant}${leaving ? " is-leaving" : ""}`}
        onPointerDown={stop}
        onPointerMove={stop}
        onWheel={stop}
        onTouchStart={stop}
      >
        {variant === "sheet" ? (
          children
        ) : (
          <>
            <button type="button" className="overlay-backdrop" aria-label="Закрыть" onClick={requestClose} />
            {children}
          </>
        )}
      </div>
    </CloseContext.Provider>,
    document.body,
  );
}
