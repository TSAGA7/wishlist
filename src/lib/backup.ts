import { currencyFromCode, type Currency } from "@/lib/money";
import type { Collection, Priority, SavingOperation, Wish, WishKind } from "@/lib/wishlist-db";

export interface BackupFile {
  version: 2;
  exportedAt: string;
  profile: { name: string };
  wishes: Wish[];
  collections: Collection[];
}

function safeHttp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function coercePriority(value: unknown): Priority {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return "medium";
}

function coerceKind(value: unknown): WishKind {
  if (value === "trip" || value === "purchase") return value;
  return "purchase";
}

function coerceSavings(value: unknown): SavingOperation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((op) => {
      if (!op || typeof op !== "object") return null;
      const row = op as Record<string, unknown>;
      const amount = typeof row.amount === "number" && Number.isFinite(row.amount) ? row.amount : 0;
      if (amount <= 0) return null;
      return {
        id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
        date: typeof row.date === "number" ? row.date : Date.now(),
        amount,
        comment: typeof row.comment === "string" ? row.comment : undefined,
      };
    })
    .filter(Boolean) as SavingOperation[];
}

function coerceWish(item: unknown, index: number): Wish | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) return null;
  const currency = currencyFromCode(typeof row.currency === "string" ? row.currency : null) ?? "RUB";
  const price =
    typeof row.price === "number" && Number.isFinite(row.price) && row.price >= 0
      ? Math.round(row.price * 100) / 100
      : null;
  const now = Date.now();
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : crypto.randomUUID();
  const kind = coerceKind(row.kind);
  return {
    id,
    kind,
    title: title.slice(0, 180),
    price,
    currency: currency satisfies Currency,
    note: typeof row.note === "string" ? row.note.slice(0, 500) : "",
    url: safeHttp(row.url),
    image: safeHttp(row.image) || null,
    priceAuto: row.priceAuto === true && price != null,
    archived: row.archived === true,
    order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : index,
    collectionId: typeof row.collectionId === "string" ? row.collectionId : null,
    priority: coercePriority(row.priority),
    targetAmount: typeof row.targetAmount === "number" && row.targetAmount >= 0 ? row.targetAmount : null,
    savedAmount: typeof row.savedAmount === "number" && row.savedAmount >= 0 ? row.savedAmount : 0,
    deadline: typeof row.deadline === "string" ? row.deadline : null,
    savingsHistory: coerceSavings(row.savingsHistory),
    countries: Array.isArray(row.countries) ? row.countries.filter((c): c is string => typeof c === "string") : [],
    cities: Array.isArray(row.cities) ? row.cities.filter((c): c is string => typeof c === "string") : [],
    startDate: typeof row.startDate === "string" ? row.startDate : null,
    endDate: typeof row.endDate === "string" ? row.endDate : null,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : now,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : now,
  };
}

function coerceCollection(item: unknown, index: number): Collection | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) return null;
  const now = Date.now();
  return {
    id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
    title: title.slice(0, 80),
    description: typeof row.description === "string" ? row.description.slice(0, 300) : "",
    icon: typeof row.icon === "string" ? row.icon : "folder",
    color: typeof row.color === "string" ? row.color : "#7c6af7",
    coverImage: safeHttp(row.coverImage) || null,
    order: typeof row.order === "number" ? row.order : index,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : now,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : now,
  };
}

export function parseBackup(raw: unknown): { name: string | null; wishes: Wish[]; collections: Collection[] } | null {
  const source = Array.isArray(raw) ? { wishes: raw } : raw;
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const list = record.wishes;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const wishes: Wish[] = [];
  list.forEach((item, index) => {
    const wish = coerceWish(item, index);
    if (!wish || seen.has(wish.id)) return;
    seen.add(wish.id);
    wishes.push(wish);
  });
  let name: string | null = null;
  if (record.profile && typeof record.profile === "object") {
    const profileName = (record.profile as { name?: unknown }).name;
    if (typeof profileName === "string" && profileName.trim()) name = profileName.trim().slice(0, 40);
  }
  const collections: Collection[] = [];
  if (Array.isArray(record.collections)) {
    record.collections.forEach((item, index) => {
      const col = coerceCollection(item, index);
      if (col) collections.push(col);
    });
  }
  return { name, wishes, collections };
}

export function buildBackup(name: string, wishes: Wish[], collections: Collection[]): BackupFile {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: { name },
    wishes,
    collections,
  };
}
