import { useEffect, useRef, type RefObject } from "react";

/**
 * Closes a floating layer when the user presses outside of it.
 * Uses pointerdown in the capture phase so sibling menus and toasts share one dismiss path.
 */
export function useDismissable(
  open: boolean,
  onClose: () => void,
  trigger?: RefObject<HTMLElement | null>,
) {
  const ref = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const node = ref.current;
      if (!node) return;
      const target = event.target as Node | null;
      if (target && node.contains(target)) return;
      if (target && trigger?.current?.contains(target)) return;
      onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, trigger]);

  return ref;
}
