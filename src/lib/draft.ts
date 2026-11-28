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
    completed: false,
    priceAuto: false,
    priority: "medium",
    collectionId: null,
    savingsEnabled: false,
    targetAmount: "",
    savedAmount: "0",
    deadline: "",
    countries: "",
    cities: "",
    startDate: "",
    endDate: "",
    location: "",
    eventDate: "",
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
    completed: wish.completed,
    priceAuto: wish.priceAuto,
    priority: wish.priority,
    collectionId: wish.collectionId,
    savingsEnabled: wish.savingsEnabled,
    targetAmount: wish.targetAmount == null ? "" : String(wish.targetAmount),
    savedAmount: String(Number.isFinite(wish.savedAmount) ? wish.savedAmount : 0),
    deadline: wish.deadline || "",
    countries: wish.countries.join(", "),
    cities: wish.cities.join(", "),
    startDate: wish.startDate || "",
    endDate: wish.endDate || "",
    location: wish.location || "",
    eventDate: wish.eventDate || "",
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
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (scheme && scheme[1].toLowerCase() !== "http" && scheme[1].toLowerCase() !== "https") return "";
  const withScheme = scheme ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname) return "";
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
