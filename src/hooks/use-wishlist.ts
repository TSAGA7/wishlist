import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildBackup, parseBackup } from "@/lib/backup";
import { canonicalUrl } from "@/lib/draft";
import { parseAmount, type Currency } from "@/lib/money";
import { wishesWord } from "@/lib/money";
import {
  DEFAULT_NAME,
  loadWishlist,
  putCollection,
  markMapSpace,
  putWish,
  removeCollection,
  removeWish,
  replaceWishlist,
  saveMapPositions,
  saveOrder,
  saveProfile,
} from "@/database/wishlist-db";
import type { Collection, Wish, WishDraft } from "@/types/wishlist";

export function useWishlist() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [currency, setCurrency] = useState<Currency>("RUB");
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [ready, setReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadWishlist()
      .then((data) => {
        if (!alive) return;
        setName(data.name);
        setCurrency(data.currency);
        setWishes(data.wishes);
        setCollections(data.collections);
        setMapReady(data.mapReady);
        setReady(true);
      })
      .catch(() => {
        toast.error("Не удалось открыть список на устройстве");
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const active = useMemo(() => wishes.filter((w) => !w.archived), [wishes]);
  const archived = useMemo(() => wishes.filter((w) => w.archived), [wishes]);

  const commitName = useCallback(async (nextRaw: string) => {
    const next = nextRaw.trim().slice(0, 40) || DEFAULT_NAME;
    setName(next);
    try {
      await saveProfile({ name: next });
    } catch {
      toast.error("Имя не сохранилось");
    }
    return next;
  }, []);

  const changeCurrency = useCallback(async (next: Currency) => {
    setCurrency(next);
    try {
      await saveProfile({ currency: next });
    } catch {
      toast.error("Валюта не сохранилась");
    }
  }, []);

  const saveDraft = useCallback(
    async (draft: WishDraft) => {
      const title = draft.title.trim();
      if (!title) {
        toast.error("Добавьте название");
        return false;
      }
      const price = parseAmount(draft.price);
      if (draft.price.trim() && price == null) {
        toast.error("Цена выглядит странно");
        return false;
      }
      const target = parseAmount(draft.targetAmount);
      const saved = parseAmount(draft.savedAmount) || 0;
      const now = Date.now();
      const existing = draft.id ? wishes.find((wish) => wish.id === draft.id) : undefined;
      const order = existing?.order ?? (wishes.length ? Math.min(...wishes.map((wish) => wish.order)) - 1 : 0);
      const wish: Wish = {
        id: draft.id ?? crypto.randomUUID(),
        kind: draft.kind,
        title: title.slice(0, 180),
        price,
        currency: draft.currency,
        note: draft.note.trim().slice(0, 500),
        url: canonicalUrl(draft.url),
        image: draft.image,
        priceAuto: draft.priceAuto && price != null,
        archived: draft.archived,
        order,
        collectionId: draft.collectionId,
        priority: draft.priority,
        targetAmount: target,
        savedAmount: Math.max(0, saved),
        deadline: draft.deadline || null,
        savingsHistory: existing?.savingsHistory || [],
        countries: draft.countries
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        cities: draft.cities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
        mapX: existing?.mapX ?? null,
        mapY: existing?.mapY ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const previous = wishes;
      setWishes((current) => [...current.filter((item) => item.id !== wish.id), wish]);
      try {
        await putWish(wish);
        toast.success(existing ? "Сохранили" : "Добавили в список");
        return true;
      } catch {
        setWishes(previous);
        toast.error("Не удалось сохранить");
        return false;
      }
    },
    [wishes],
  );

  const upsertWish = useCallback(async (wish: Wish) => {
    const previous = wishes;
    setWishes((current) => {
      const exists = current.some((item) => item.id === wish.id);
      return exists
        ? current.map((item) => (item.id === wish.id ? wish : item))
        : [...current, wish];
    });
    try {
      await putWish(wish);
    } catch {
      setWishes(previous);
      toast.error("Не удалось сохранить");
    }
  }, [wishes]);

  const setArchived = useCallback(
    async (wish: Wish, archivedFlag: boolean) => {
      const next = { ...wish, archived: archivedFlag, updatedAt: Date.now() };
      const previous = wishes;
      setWishes((current) => current.map((item) => (item.id === wish.id ? next : item)));
      try {
        await putWish(next);
        toast(archivedFlag ? "В архиве" : "Снова в списке", {
          action: {
            label: "Отменить",
            onClick: () => {
              setWishes(previous);
              void putWish(wish);
            },
          },
        });
      } catch {
        setWishes(previous);
        toast.error("Не получилось");
      }
    },
    [wishes],
  );

  const deleteWish = useCallback(
    async (wish: Wish) => {
      const previous = wishes;
      setWishes((current) => current.filter((item) => item.id !== wish.id));
      try {
        await removeWish(wish.id);
        toast("Удалили", {
          action: {
            label: "Вернуть",
            onClick: () => {
              setWishes(previous);
              void putWish(wish);
            },
          },
        });
      } catch {
        setWishes(previous);
        toast.error("Не удалось удалить");
      }
    },
    [wishes],
  );

  const persistMapPositions = useCallback(
    async (updates: Array<{ id: string; mapX: number; mapY: number }>, markReady = false) => {
      if (markReady) setMapReady(true);
      if (updates.length) {
        const byId = new Map(updates.map((update) => [update.id, update]));
        setWishes((current) =>
          current.map((wish) => {
            const next = byId.get(wish.id);
            return next ? { ...wish, mapX: next.mapX, mapY: next.mapY } : wish;
          }),
        );
      }
      try {
        if (updates.length) await saveMapPositions(updates);
        if (markReady) await markMapSpace();
      } catch {
        toast.error("Координаты карты не сохранились");
      }
    },
    [],
  );

  const reorder = useCallback(
    async (ids: string[]) => {
      const orderOf = new Map(ids.map((id, index) => [id, index]));
      const previous = wishes;
      setWishes((current) =>
        current.map((wish) => (orderOf.has(wish.id) ? { ...wish, order: orderOf.get(wish.id)! } : wish)),
      );
      try {
        await saveOrder(ids);
      } catch {
        setWishes(previous);
        toast.error("Порядок не сохранился");
      }
    },
    [wishes],
  );

  const saveCollection = useCallback(
    async (collection: Collection) => {
      const previous = collections;
      setCollections((current) => {
        const without = current.filter((c) => c.id !== collection.id);
        return [...without, collection].sort((a, b) => a.order - b.order);
      });
      try {
        await putCollection(collection);
        toast.success(previous.some((c) => c.id === collection.id) ? "Подборка сохранена" : "Подборка создана");
        return true;
      } catch {
        setCollections(previous);
        toast.error("Не удалось сохранить подборку");
        return false;
      }
    },
    [collections],
  );

  const deleteCollection = useCallback(
    async (collection: Collection) => {
      const previousCollections = collections;
      const previousWishes = wishes;
      setCollections((current) => current.filter((c) => c.id !== collection.id));
      setWishes((current) =>
        current.map((w) => (w.collectionId === collection.id ? { ...w, collectionId: null } : w)),
      );
      try {
        await removeCollection(collection.id);
        toast.success("Подборка удалена");
      } catch {
        setCollections(previousCollections);
        setWishes(previousWishes);
        toast.error("Не удалось удалить подборку");
      }
    },
    [collections, wishes],
  );

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildBackup(name, wishes, collections), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wishlist.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Файл с копией скачан");
  }, [name, wishes, collections]);

  const importFile = useCallback(async (file: File) => {
    const text = await file.text();
    try {
      const parsed = parseBackup(JSON.parse(text));
      if (!parsed || !parsed.wishes.length) {
        toast.error("В файле нет хотелок");
        return null;
      }
      return parsed;
    } catch {
      toast.error("Файл не читается");
      return null;
    }
  }, []);

  const confirmImport = useCallback(
    async (nextName: string | null, nextWishes: Wish[], nextCollections: Collection[]) => {
      const previous = { name, wishes, collections };
      if (nextName?.trim()) setName(nextName.trim());
      setWishes(nextWishes);
      setCollections(nextCollections);
      try {
        await replaceWishlist(nextName, nextWishes, nextCollections);
        toast.success(`Список заменён: ${nextWishes.length} ${wishesWord(nextWishes.length)}`);
        return true;
      } catch {
        setName(previous.name);
        setWishes(previous.wishes);
        setCollections(previous.collections);
        toast.error("Не удалось восстановить копию");
        return false;
      }
    },
    [name, wishes, collections],
  );

  return {
    ready,
    mapReady,
    name,
    setName,
    currency,
    wishes,
    collections,
    active,
    archived,
    commitName,
    changeCurrency,
    saveDraft,
    upsertWish,
    persistMapPositions,
    setArchived,
    deleteWish,
    reorder,
    saveCollection,
    deleteCollection,
    exportJson,
    importFile,
    confirmImport,
  };
}
