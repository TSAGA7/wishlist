import Dexie, { type EntityTable } from "dexie";
import type { Currency } from "@/lib/money";

export interface Wish {
  id: string;
  title: string;
  price: number | null;
  currency: Currency;
  note: string;
  url: string;
  image: string | null;
  priceAuto: boolean;
  archived: boolean;
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
    db = next;
  }
  return db;
}

const DEFAULT_NAME = "Мои хотелки";

export async function loadWishlist(): Promise<{ name: string; currency: Currency; wishes: Wish[] }> {
  const store = database();
  const [wishes, profile] = await Promise.all([store.wishes.toArray(), store.meta.get("profile")]);
  wishes.sort((a, b) => a.order - b.order);
  const currency = profile?.currency === "USD" || profile?.currency === "EUR" ? profile.currency : "RUB";
  return { name: profile?.name?.trim() || DEFAULT_NAME, currency, wishes };
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

export async function saveOrder(ids: string[]): Promise<void> {
  const store = database();
  await store.transaction("rw", store.wishes, async () => {
    await Promise.all(ids.map((id, index) => store.wishes.update(id, { order: index })));
  });
}

export async function replaceWishlist(name: string | null, wishes: Wish[]): Promise<void> {
  const store = database();
  await store.transaction("rw", store.wishes, store.meta, async () => {
    await store.wishes.clear();
    if (wishes.length) await store.wishes.bulkAdd(wishes);
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
