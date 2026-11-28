import Dexie, { type EntityTable } from "dexie";
import type { Currency } from "@/lib/money";
import { isWishKind } from "@/lib/kinds";
import { normalizeSettings } from "@/lib/navigation";
import {
  DEFAULT_DOCK_ORDER,
  type AppSettings,
  type Collection,
  type DockTab,
  type ThemeMode,
  type Wish,
} from "@/types/wishlist";

export type { Collection, Priority, SavingOperation, Wish, WishKind } from "@/types/wishlist";

interface MetaRow {
  key: string;
  name?: string;
  currency?: Currency;
  theme?: ThemeMode;
  dockOrder?: DockTab[];
  homeScreen?: DockTab;
  dockHidden?: DockTab[];
  exportedAt?: string;
}

export interface PhotoRow {
  id: string;
  blob: Blob;
  mime: string;
  createdAt: number;
}

type WishlistDB = Dexie & {
  wishes: EntityTable<Wish, "id">;
  collections: EntityTable<Collection, "id">;
  meta: EntityTable<MetaRow, "key">;
  photos: EntityTable<PhotoRow, "id">;
};

let db: WishlistDB | null = null;

function database(): WishlistDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("Хранилище недоступно в этом браузере");
  }
  if (!db) {
    const next = new Dexie("wishlist") as WishlistDB;
    next.version(1).stores({
      wishes: "id, order, updatedAt",
      meta: "key",
    });
    next
      .version(2)
      .stores({
        wishes: "id, order, updatedAt, kind, collectionId, priority, archived",
        collections: "id, order",
        meta: "key",
      })
      .upgrade(async (tx) => {
        const wishes = await tx.table("wishes").toArray();
        for (const w of wishes) {
          await tx.table("wishes").update(w.id, {
            kind: "purchase",
            collectionId: null,
            priority: "medium",
            targetAmount: null,
            savedAmount: 0,
            deadline: null,
            savingsHistory: [],
            countries: [],
            cities: [],
            startDate: null,
            endDate: null,
          });
        }
      });
    next
      .version(3)
      .stores({
        wishes: "id, order, updatedAt, kind, collectionId, priority, archived",
        collections: "id, order",
        meta: "key",
      })
      .upgrade(async (tx) => {
        const wishes = await tx.table("wishes").toArray();
        for (const w of wishes) {
          const row = w as Wish;
          if (row.mapX == null || row.mapY == null) {
            await tx.table("wishes").update(w.id, {
              mapX: row.mapX ?? null,
              mapY: row.mapY ?? null,
            });
          }
        }
      });
    next
      .version(4)
      .stores({
        wishes: "id, order, updatedAt, kind, collectionId, priority, archived, completed",
        collections: "id, order",
        meta: "key",
        photos: "id, createdAt",
      })
      .upgrade(async (tx) => {
        const wishes = await tx.table("wishes").toArray();
        for (const w of wishes) {
          const row = w as Partial<Wish> & { id: string };
          const kind = isWishKind(row.kind) ? row.kind : "purchase";
          const savedAmount = typeof row.savedAmount === "number" ? row.savedAmount : 0;
          const targetAmount =
            typeof row.targetAmount === "number" && Number.isFinite(row.targetAmount) ? row.targetAmount : null;
          const hasSavings =
            savedAmount > 0 ||
            targetAmount != null ||
            (Array.isArray(row.savingsHistory) && row.savingsHistory.length > 0) ||
            Boolean(row.deadline);
          await tx.table("wishes").update(row.id, {
            kind,
            completed: row.completed === true,
            savingsEnabled: row.savingsEnabled === true || hasSavings,
            location: typeof row.location === "string" ? row.location : "",
            eventDate: typeof row.eventDate === "string" ? row.eventDate : null,
          });
        }
        const settings = await tx.table("meta").get("settings");
        if (!settings) {
          const initial = normalizeSettings({ theme: "system", dockOrder: [...DEFAULT_DOCK_ORDER] });
          await tx.table("meta").put({
            key: "settings",
            theme: initial.theme,
            homeScreen: initial.homeScreen,
            dockOrder: initial.dockOrder,
            dockHidden: initial.dockHidden,
          });
        }
      });
    next.on("blocked", () => {
      console.warn("[Wishlist] IndexedDB blocked: another tab holds the connection. The database was not deleted.");
    });
    next.on("versionchange", () => {
      next.close();
      if (db === next) db = null;
      console.warn("[Wishlist] IndexedDB versionchange: connection closed. The database was not deleted.");
    });
    db = next;
  }
  return db;
}

const DEFAULT_NAME = "Мои хотелки";

const OPEN_TIMEOUT_MS = 8000;

export function formatStorageError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name || "Error";
    const message = error.message || "не удалось прочитать локальную базу";
    const text = message.startsWith(name) ? message : `${name}: ${message}`;
    const lines = [...new Set(text.split(/\n+/).map((line) => line.trim()).filter(Boolean))];
    return lines.join(" ").slice(0, 300);
  }
  return "UnknownError: не удалось прочитать локальную базу";
}

/** Dexie names we surface as-is: DatabaseClosedError, VersionError, UpgradeError, OpenFailedError, plus DOMException QuotaExceededError, UnknownError, AbortError. */
export async function openWishlistDatabase(): Promise<WishlistDB> {
  const store = database();
  if (store.isOpen()) return store;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const opened = store.open();
  void opened.catch(() => undefined);
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("Браузер не открыл локальную базу за 8 секунд");
        error.name = "TimeoutError";
        reject(error);
      }, OPEN_TIMEOUT_MS);
    });
    await Promise.race([opened, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return store;
}

/** Close a stuck connection and open the same `wishlist` database again. Never deletes data. */
export async function reopenWishlistDatabase(): Promise<void> {
  if (db) {
    try {
      db.close();
    } catch (error) {
      console.warn("[Wishlist] IndexedDB close failed", error instanceof Error ? error.name : "Error");
    }
    db = null;
  }
  await openWishlistDatabase();
}

export interface PersistentStorageStatus {
  supported: boolean;
  persisted: boolean;
  usage?: number | null;
  quota?: number | null;
}

export async function requestPersistentStorage(): Promise<PersistentStorageStatus> {
  if (!("storage" in navigator)) {
    return { supported: false, persisted: false };
  }

  try {
    const storage = navigator.storage;
    const before = storage.persisted ? await storage.persisted() : false;

    const persisted = before || (storage.persist ? await storage.persist() : false);

    const estimate = storage.estimate ? await storage.estimate() : undefined;

    return {
      supported: true,
      persisted,
      usage: estimate?.usage ?? null,
      quota: estimate?.quota ?? null,
    };
  } catch (error) {
    console.warn("[Wishlist] Persistent storage request failed", error instanceof Error ? error.name : "Error");
    return { supported: true, persisted: false };
  }
}

export interface StorageDiagnostic {
  name: string;
  version: number;
  wishes: number;
  collections: number;
  photos: number;
  hasProfile: boolean;
  hasSettings: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

export async function diagnoseStorage(): Promise<StorageDiagnostic> {
  const store = await openWishlistDatabase();
  const [wishes, collections, photos, profile, settings] = await Promise.all([
    store.wishes.count(),
    store.collections.count(),
    store.photos.count(),
    store.meta.get("profile"),
    store.meta.get("settings"),
  ]);
  let persisted: boolean | null = null;
  let usage: number | null = null;
  let quota: number | null = null;
  if ("storage" in navigator) {
    try {
      persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        usage = estimate.usage ?? null;
        quota = estimate.quota ?? null;
      }
    } catch (error) {
      console.warn("[Wishlist] storage estimate failed", error instanceof Error ? error.name : "Error");
    }
  }
  const report: StorageDiagnostic = {
    name: store.name,
    version: store.verno,
    wishes,
    collections,
    photos,
    hasProfile: Boolean(profile),
    hasSettings: Boolean(settings),
    persisted,
    usage,
    quota,
  };
  console.info("[Wishlist] storage", report);
  return report;
}

function normalizeWish(wish: Wish): Wish {
  const kind = isWishKind(wish.kind) ? wish.kind : "purchase";
  return {
    ...wish,
    kind,
    completed: wish.completed === true,
    savingsEnabled: wish.savingsEnabled === true,
    mapX: wish.mapX ?? null,
    mapY: wish.mapY ?? null,
    savingsHistory: Array.isArray(wish.savingsHistory) ? wish.savingsHistory : [],
    countries: Array.isArray(wish.countries) ? wish.countries : [],
    cities: Array.isArray(wish.cities) ? wish.cities : [],
    location: typeof wish.location === "string" ? wish.location : "",
    eventDate: typeof wish.eventDate === "string" ? wish.eventDate : null,
    savedAmount: Number.isFinite(wish.savedAmount) ? Math.max(0, wish.savedAmount) : 0,
  };
}

export async function loadWishlist(): Promise<{
  name: string;
  currency: Currency;
  wishes: Wish[];
  collections: Collection[];
  mapReady: boolean;
  settings: AppSettings;
  lastExportedAt: string | null;
}> {
  const store = await openWishlistDatabase();
  const [wishesRaw, collections, profile, settingsRow, backupRow] = await Promise.all([
    store.wishes.toArray(),
    store.collections.toArray(),
    store.meta.get("profile"),
    store.meta.get("settings"),
    store.meta.get("backup"),
  ]);
  const wishes = wishesRaw.map(normalizeWish);
  wishes.sort((a, b) => a.order - b.order);
  collections.sort((a, b) => a.order - b.order);
  const currency = profile?.currency === "USD" || profile?.currency === "EUR" ? profile.currency : "RUB";
  const space = await store.meta.get("map-space");
  return {
    name: profile?.name?.trim() || DEFAULT_NAME,
    currency,
    wishes,
    collections,
    mapReady: space?.name === "percent-v1",
    settings: normalizeSettings({
      theme: settingsRow?.theme,
      homeScreen: settingsRow?.homeScreen,
      dockOrder: settingsRow?.dockOrder,
      dockHidden: settingsRow?.dockHidden,
    }),
    lastExportedAt: typeof backupRow?.exportedAt === "string" ? backupRow.exportedAt : null,
  };
}

export async function rememberBackupExport(exportedAt: string): Promise<void> {
  const store = await openWishlistDatabase();
  await store.meta.put({ key: "backup", exportedAt });
}

export async function saveProfile(patch: { name?: string; currency?: Currency }): Promise<void> {
  const store = database();
  const current = await store.meta.get("profile");
  await store.meta.put({
    key: "profile",
    name: patch.name?.trim() || current?.name || DEFAULT_NAME,
    currency: patch.currency ?? current?.currency ?? "RUB",
  });
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const store = database();
  const current = await store.meta.get("settings");
  const next = normalizeSettings({
    theme: patch.theme ?? current?.theme,
    homeScreen: patch.homeScreen ?? current?.homeScreen,
    dockOrder: patch.dockOrder ?? current?.dockOrder,
    dockHidden: patch.dockHidden ?? current?.dockHidden,
  });
  await store.meta.put({
    key: "settings",
    theme: next.theme,
    homeScreen: next.homeScreen,
    dockOrder: next.dockOrder,
    dockHidden: next.dockHidden,
  });
  return next;
}

export async function putWish(wish: Wish): Promise<void> {
  await database().wishes.put(normalizeWish(wish));
}

export async function removeWish(id: string): Promise<void> {
  const store = database();
  const wish = await store.wishes.get(id);
  await store.wishes.delete(id);
  if (wish?.image?.startsWith("idb:")) {
    await store.photos.delete(wish.image.slice(4)).catch(() => undefined);
  }
}

export async function putCollection(collection: Collection): Promise<void> {
  await database().collections.put(collection);
}

export async function removeCollection(id: string): Promise<void> {
  const store = database();
  await store.transaction("rw", store.wishes, store.collections, async () => {
    await store.collections.delete(id);
    const wishes = await store.wishes.where("collectionId").equals(id).toArray();
    for (const w of wishes) {
      await store.wishes.update(w.id, { collectionId: null });
    }
  });
}

export async function saveMapPositions(updates: Array<{ id: string; mapX: number; mapY: number }>): Promise<void> {
  if (!updates.length) return;
  const store = database();
  await store.transaction("rw", store.wishes, async () => {
    await Promise.all(updates.map((update) => store.wishes.update(update.id, { mapX: update.mapX, mapY: update.mapY })));
  });
}

export async function markMapSpace(): Promise<void> {
  await database().meta.put({ key: "map-space", name: "percent-v1" });
}

export async function saveOrder(ids: string[]): Promise<void> {
  const store = database();
  await store.transaction("rw", store.wishes, async () => {
    await Promise.all(ids.map((id, index) => store.wishes.update(id, { order: index })));
  });
}

export async function saveCollectionOrder(ids: string[]): Promise<void> {
  const store = database();
  await store.transaction("rw", store.collections, async () => {
    await Promise.all(ids.map((id, index) => store.collections.update(id, { order: index })));
  });
}

export async function putPhoto(blob: Blob, id = crypto.randomUUID()): Promise<string> {
  const store = database();
  await store.photos.put({
    id,
    blob,
    mime: blob.type || "image/jpeg",
    createdAt: Date.now(),
  });
  return `idb:${id}`;
}

export async function getPhotoBlob(ref: string): Promise<Blob | null> {
  if (!ref.startsWith("idb:")) return null;
  const row = await database().photos.get(ref.slice(4));
  return row?.blob ?? null;
}

export async function removePhoto(ref: string | null): Promise<void> {
  if (!ref?.startsWith("idb:")) return;
  await database().photos.delete(ref.slice(4)).catch(() => undefined);
}

export async function replaceWishlist(
  name: string | null,
  wishes: Wish[],
  collections: Collection[] = [],
  extras?: {
    photos?: Array<{ id: string; blob: Blob; mime: string }>;
    currency?: Currency;
    settings?: AppSettings;
  },
): Promise<void> {
  const store = await openWishlistDatabase();
  await store.transaction("rw", store.wishes, store.collections, store.meta, store.photos, async () => {
    await store.wishes.clear();
    await store.collections.clear();
    await store.photos.clear();
    if (wishes.length) await store.wishes.bulkAdd(wishes.map(normalizeWish));
    if (collections.length) await store.collections.bulkAdd(collections);
    if (extras?.photos?.length) {
      const now = Date.now();
      await store.photos.bulkAdd(
        extras.photos.map((photo) => ({
          id: photo.id,
          blob: photo.blob,
          mime: photo.mime || photo.blob.type || "image/jpeg",
          createdAt: now,
        })),
      );
    }
    if (name?.trim() || extras?.currency) {
      const current = await store.meta.get("profile");
      await store.meta.put({
        key: "profile",
        name: name?.trim() || current?.name || DEFAULT_NAME,
        currency: extras?.currency ?? current?.currency ?? "RUB",
      });
    }
    if (extras?.settings) {
      const next = normalizeSettings(extras.settings);
      await store.meta.put({
        key: "settings",
        theme: next.theme,
        homeScreen: next.homeScreen,
        dockOrder: next.dockOrder,
        dockHidden: next.dockHidden,
      });
    }
  });
}

export { DEFAULT_NAME };
