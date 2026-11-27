import Dexie, { type EntityTable } from "dexie";
import type { Currency } from "@/lib/money";
import type { Collection, Wish } from "@/types/wishlist";

export type { Collection, Priority, SavingOperation, Wish, WishKind } from "@/types/wishlist";

interface MetaRow {
  key: string;
  name?: string;
  currency?: Currency;
}

type WishlistDB = Dexie & {
  wishes: EntityTable<Wish, "id">;
  collections: EntityTable<Collection, "id">;
  meta: EntityTable<MetaRow, "key">;
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
    db = next;
  }
  return db;
}

const DEFAULT_NAME = "Мои хотелки";

function normalizeWish(wish: Wish): Wish {
  return {
    ...wish,
    mapX: wish.mapX ?? null,
    mapY: wish.mapY ?? null,
    savingsHistory: Array.isArray(wish.savingsHistory) ? wish.savingsHistory : [],
    countries: Array.isArray(wish.countries) ? wish.countries : [],
    cities: Array.isArray(wish.cities) ? wish.cities : [],
  };
}

export async function loadWishlist(): Promise<{
  name: string;
  currency: Currency;
  wishes: Wish[];
  collections: Collection[];
  mapReady: boolean;
}> {
  const store = database();
  const [wishesRaw, collections, profile] = await Promise.all([
    store.wishes.toArray(),
    store.collections.toArray(),
    store.meta.get("profile"),
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
  };
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

export async function putWish(wish: Wish): Promise<void> {
  await database().wishes.put(normalizeWish(wish));
}

export async function removeWish(id: string): Promise<void> {
  await database().wishes.delete(id);
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

export async function replaceWishlist(
  name: string | null,
  wishes: Wish[],
  collections: Collection[] = [],
): Promise<void> {
  const store = database();
  await store.transaction("rw", store.wishes, store.collections, store.meta, async () => {
    await store.wishes.clear();
    await store.collections.clear();
    if (wishes.length) await store.wishes.bulkAdd(wishes.map(normalizeWish));
    if (collections.length) await store.collections.bulkAdd(collections);
    if (name?.trim()) {
      const current = await store.meta.get("profile");
      await store.meta.put({
        key: "profile",
        name: name.trim(),
        currency: current?.currency ?? "RUB",
      });
    }
  });
}

export { DEFAULT_NAME };
