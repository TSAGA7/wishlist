import { currencyFromCode, type Currency } from "@/lib/money";
import type { Wish } from "@/lib/wishlist-db";

export interface BackupFile {
  version: 1;
  exportedAt: string;
  profile: { name: string };
  wishes: Wish[];
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
  return {
    id,
    title: title.slice(0, 180),
    price,
    currency: currency satisfies Currency,
    note: typeof row.note === "string" ? row.note.slice(0, 500) : "",
    url: safeHttp(row.url),
    image: safeHttp(row.image) || null,
    priceAuto: row.priceAuto === true && price != null,
    archived: row.archived === true,
    order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : index,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : now,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : now,
  };
}

export function parseBackup(raw: unknown): { name: string | null; wishes: Wish[] } | null {
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
  return { name, wishes };
}

export function buildBackup(name: string, wishes: Wish[]): BackupFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: { name },
    wishes,
  };
}
