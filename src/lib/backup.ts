import { currencyFromCode, type Currency } from "@/lib/money";
import { isWishKind } from "@/lib/kinds";
import type { AppSettings, Collection, DockTab, Priority, SavingOperation, ThemeMode, Wish, WishKind } from "@/types/wishlist";
import { DEFAULT_DOCK_ORDER } from "@/types/wishlist";

export interface BackupFile {
  version: 3;
  exportedAt: string;
  profile: { name: string; currency?: Currency };
  settings?: AppSettings;
  wishes: Wish[];
  collections: Collection[];
}

function safeHttp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  if (value.startsWith("idb:") || value.startsWith("data:image/")) return value.trim();
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
  if (isWishKind(value)) return value;
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
  const savedAmount = typeof row.savedAmount === "number" && row.savedAmount >= 0 ? row.savedAmount : 0;
  const targetAmount = typeof row.targetAmount === "number" && row.targetAmount >= 0 ? row.targetAmount : null;
  const history = coerceSavings(row.savingsHistory);
  const deadline = typeof row.deadline === "string" ? row.deadline : null;
  const savingsEnabled =
    row.savingsEnabled === true ||
    savedAmount > 0 ||
    targetAmount != null ||
    history.length > 0 ||
    Boolean(deadline);
  return {
    id,
    kind,
    title: title.slice(0, 180),
    price,
    currency: currency satisfies Currency,
    note: typeof row.note === "string" ? row.note.slice(0, 500) : "",
    url: safeHttp(row.url).startsWith("http") ? safeHttp(row.url) : "",
    image: safeHttp(row.image) || null,
    priceAuto: row.priceAuto === true && price != null,
    archived: row.archived === true,
    completed: row.completed === true,
    order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : index,
    collectionId: typeof row.collectionId === "string" ? row.collectionId : null,
    priority: coercePriority(row.priority),
    savingsEnabled,
    targetAmount,
    savedAmount,
    deadline,
    savingsHistory: history,
    countries: Array.isArray(row.countries) ? row.countries.filter((c): c is string => typeof c === "string") : [],
    cities: Array.isArray(row.cities) ? row.cities.filter((c): c is string => typeof c === "string") : [],
    startDate: typeof row.startDate === "string" ? row.startDate : null,
    endDate: typeof row.endDate === "string" ? row.endDate : null,
    location: typeof row.location === "string" ? row.location.slice(0, 200) : "",
    eventDate: typeof row.eventDate === "string" ? row.eventDate : null,
    mapX: typeof row.mapX === "number" && Number.isFinite(row.mapX) ? row.mapX : null,
    mapY: typeof row.mapY === "number" && Number.isFinite(row.mapY) ? row.mapY : null,
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

function coerceSettings(raw: unknown): AppSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const theme: ThemeMode =
    row.theme === "light" || row.theme === "dark" || row.theme === "system" ? row.theme : "system";
  const allowed = new Set<DockTab>(DEFAULT_DOCK_ORDER);
  const dockOrder = Array.isArray(row.dockOrder)
    ? (["home", ...row.dockOrder.filter((t): t is DockTab => typeof t === "string" && allowed.has(t as DockTab) && t !== "home")] as DockTab[])
    : [...DEFAULT_DOCK_ORDER];
  const unique: DockTab[] = ["home"];
  for (const tab of dockOrder) {
    if (tab !== "home" && !unique.includes(tab)) unique.push(tab);
  }
  for (const tab of DEFAULT_DOCK_ORDER) {
    if (!unique.includes(tab)) unique.push(tab);
  }
  return { theme, dockOrder: unique };
}

export function parseBackup(
  raw: unknown,
): { name: string | null; currency?: Currency; wishes: Wish[]; collections: Collection[]; settings?: AppSettings } | null {
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
  let currency: Currency | undefined;
  if (record.profile && typeof record.profile === "object") {
    const profile = record.profile as { name?: unknown; currency?: unknown };
    if (typeof profile.name === "string" && profile.name.trim()) name = profile.name.trim().slice(0, 40);
    currency = currencyFromCode(typeof profile.currency === "string" ? profile.currency : null) ?? undefined;
  }
  const collections: Collection[] = [];
  if (Array.isArray(record.collections)) {
    record.collections.forEach((item, index) => {
      const col = coerceCollection(item, index);
      if (col) collections.push(col);
    });
  }
  return { name, currency, wishes, collections, settings: coerceSettings(record.settings) };
}

export function buildBackup(
  name: string,
  wishes: Wish[],
  collections: Collection[],
  extras?: { currency?: Currency; settings?: AppSettings },
): BackupFile {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    profile: { name, currency: extras?.currency },
    settings: extras?.settings,
    wishes,
    collections,
  };
}

export function backupFileName(name: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  return `wishlist-${safe || "backup"}-${stamp}.json`;
}
