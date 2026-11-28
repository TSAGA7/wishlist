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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
