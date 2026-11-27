import type { HomeFilter, WishKind } from "@/types/wishlist";

export const WISH_KINDS: WishKind[] = ["purchase", "trip", "venue", "place", "event"];

export function kindLabel(kind: WishKind): string {
  switch (kind) {
    case "trip":
      return "Поездка";
    case "venue":
      return "Заведение";
    case "place":
      return "Место";
    case "event":
      return "Событие";
    default:
      return "Покупка";
  }
}

export function kindHint(kind: WishKind): string {
  switch (kind) {
    case "trip":
      return "Путешествие, страна, город, маршрут";
    case "venue":
      return "Ресторан, кафе, бар, отель";
    case "place":
      return "Парк, достопримечательность, музей";
    case "event":
      return "Концерт, театр, матч, выставка";
    default:
      return "Товар, техника, одежда, аксессуары";
  }
}

export function isWishKind(value: unknown): value is WishKind {
  return value === "purchase" || value === "trip" || value === "venue" || value === "place" || value === "event";
}

export function filterMatchesKind(filter: HomeFilter, kind: WishKind): boolean {
  if (filter === "all") return true;
  if (filter === "purchases") return kind === "purchase";
  if (filter === "trips") return kind === "trip";
  if (filter === "venues") return kind === "venue";
  if (filter === "places") return kind === "place";
  if (filter === "events") return kind === "event";
  return true;
}
