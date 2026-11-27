import type { Currency } from "@/lib/money";
import type { CollectionDraft, Wish, WishDraft, WishKind } from "@/types/wishlist";

export function emptyWishDraft(currency: Currency, kind: WishKind = "purchase"): WishDraft {
  return {
    id: null,
    kind,
    url: "",
    title: "",
    price: "",
    currency,
    note: "",
    image: null,
    archived: false,
    priceAuto: false,
    priority: "medium",
    collectionId: null,
    targetAmount: "",
    savedAmount: "0",
    deadline: "",
    countries: "",
    cities: "",
    startDate: "",
    endDate: "",
  };
}

export function draftFromWish(wish: Wish): WishDraft {
  return {
    id: wish.id,
    kind: wish.kind,
    url: wish.url,
    title: wish.title,
    price: wish.price == null ? "" : String(wish.price),
    currency: wish.currency,
    note: wish.note,
    image: wish.image,
    archived: wish.archived,
    priceAuto: wish.priceAuto,
    priority: wish.priority,
    collectionId: wish.collectionId,
    targetAmount: wish.targetAmount == null ? "" : String(wish.targetAmount),
    savedAmount: String(wish.savedAmount),
    deadline: wish.deadline || "",
    countries: wish.countries.join(", "),
    cities: wish.cities.join(", "),
    startDate: wish.startDate || "",
    endDate: wish.endDate || "",
  };
}

export function emptyCollectionDraft(): CollectionDraft {
  return {
    id: null,
    title: "",
    description: "",
    icon: "folder",
    color: "#7c6af7",
    coverImage: null,
  };
}

export function canonicalUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function hostOf(url: string): string | null {
  const canonical = canonicalUrl(url);
  if (!canonical) return null;
  try {
    return new URL(canonical).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
