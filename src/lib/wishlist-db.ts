import Dexie, { type EntityTable } from "dexie";
import type { Currency } from "@/lib/money";

export type WishKind = "purchase" | "trip";
export type Priority = "low" | "medium" | "high" | "critical";

export interface SavingOperation {
  id: string;
  date: number;
  amount: number;
  comment?: string;
}

export interface Wish {
  id: string;
  kind: WishKind;
  title: string;
  price: number | null;
  currency: Currency;
  note: string;
  url: string;
  image: string | null;
  priceAuto: boolean;
  archived: boolean;
  order: number;
  collectionId: string | null;
  priority: Priority;
  // Savings
  targetAmount: number | null;
  savedAmount: number;
  deadline: string | null; // YYYY-MM-DD
  savingsHistory: SavingOperation[];
  // Trip specific
  countries: string[];
  cities: string[];
  startDate: string | null;
  endDate: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  coverImage: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

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
    next.version(2).stores({
      wishes: "id, order, updatedAt, kind, collectionId, priority, archived",
      collections: "id, order",
      meta: "key",
    }).upgrade(async (tx) => {
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
    db = next;
  }
  return db;
}

const DEFAULT_NAME = "Мои хотелки";

export async function loadWishlist(): Promise<{ name: string; currency: Currency; wishes: Wish[]; collections: Collection[] }> {
  const store = database();
  const [wishes, collections, profile] = await Promise.all([
    store.wishes.toArray(),
    store.collections.toArray(),
    store.meta.get("profile"),
  ]);
  wishes.sort((a, b) => a.order - b.order);
  collections.sort((a, b) => a.order - b.order);
  const currency = profile?.currency === "USD" || profile?.currency === "EUR" ? profile.currency : "RUB";
  return {
    name: profile?.name?.trim() || DEFAULT_NAME,
    currency,
    wishes,
    collections,
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
  await database().wishes.put(wish);
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

export async function saveOrder(ids: string[]): Promise<void> {
  const store = database();
  await store.transaction("rw", store.wishes, async () => {
    await Promise.all(ids.map((id, index) => store.wishes.update(id, { order: index })));
  });
}

export async function replaceWishlist(name: string | null, wishes: Wish[], collections: Collection[] = []): Promise<void> {
  const store = database();
  await store.transaction("rw", store.wishes, store.collections, store.meta, async () => {
    await store.wishes.clear();
    await store.collections.clear();
    if (wishes.length) await store.wishes.bulkAdd(wishes);
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
