import { useEffect, useMemo, useRef } from "react";
import CosmicWishlist, { type CosmicWish } from "@/features/cosmic/CosmicWishlist";
import { layoutPlanets } from "@/features/cosmic/layout";
import type { Wish } from "@/types/wishlist";

export function CosmicMap({
  wishes,
  ready,
  mapReady,
  showAdd = true,
  onOpen,
  onAdd,
  onSettings,
  onPersistPositions,
}: {
  wishes: Wish[];
  ready: boolean;
  mapReady: boolean;
  showAdd?: boolean;
  onOpen: (wish: Wish) => void;
  onAdd: () => void;
  onSettings?: () => void;
  onPersistPositions?: (updates: Array<{ id: string; mapX: number; mapY: number }>, markReady: boolean) => void;
}) {
  const persistRef = useRef(onPersistPositions);
  persistRef.current = onPersistPositions;
  const attempts = useRef(0);

  const { cosmic, updates } = useMemo(() => {
    const { placed, updates: next } = layoutPlanets(wishes, mapReady);
    const visible = wishes.filter((wish) => !wish.archived);
    const cosmicWishes: CosmicWish[] = visible.map((wish) => {
      const pose = placed.get(wish.id) ?? { x: 50, y: 51, size: "hero" as const };
      const subtitle = wish.kind === "trip" ? [...wish.cities, ...wish.countries].filter(Boolean).slice(0, 3).join(" · ") : "";
      return {
        id: wish.id,
        title: wish.title,
        kind: wish.kind,
        image: wish.image,
        price: wish.price,
        currency: wish.currency,
        priority: wish.priority,
        savedAmount: wish.savedAmount,
        targetAmount: wish.targetAmount,
        deadline: wish.deadline,
        subtitle: subtitle || undefined,
        x: pose.x,
        y: pose.y,
        size: pose.size,
      };
    });
    return { cosmic: cosmicWishes, updates: next };
  }, [wishes, mapReady]);

  useEffect(() => {
    if (!ready) return;
    const persist = persistRef.current;
    if (!persist) return;
    if (!updates.length) return;
    if (attempts.current > 3) return;
    attempts.current += 1;
    persist(updates, !mapReady);
  }, [ready, mapReady, updates]);

  return (
    <CosmicWishlist
      wishes={cosmic}
      showAdd={showAdd}
      onOpenWish={(wish) => {
        const source = wishes.find((item) => item.id === wish.id);
        if (source) onOpen(source);
      }}
      onAddWish={onAdd}
      onOpenSettings={onSettings}
      onRetryImage={() => undefined}
    />
  );
}
