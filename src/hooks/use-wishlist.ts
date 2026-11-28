import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MAX_BACKUP_DATA_URL_CHARS,
  MAX_BACKUP_PHOTO_BYTES,
  backupFileName,
  blobToDataUrl,
  buildBackup,
  localPhotoIds,
  parseBackup,
  type BackupPhoto,
  type ParsedBackupPhoto,
} from "@/lib/backup";
import { canonicalUrl } from "@/lib/draft";
import { parseAmount, type Currency } from "@/lib/money";
import { wishesWord } from "@/lib/money";
import {
  DEFAULT_NAME,
  diagnoseStorage,
  formatStorageError,
  getPhotoBlob,
  loadWishlist,
  putCollection,
  markMapSpace,
  putWish,
  rememberBackupExport,
  removeCollection,
  removeWish,
  reopenWishlistDatabase,
  replaceWishlist,
  requestPersistentStorage,
  saveMapPositions,
  saveOrder,
  saveProfile,
  saveSettings,
  type PersistentStorageStatus,
} from "@/database/wishlist-db";
import { normalizeSettings } from "@/lib/navigation";
import type { AppSettings, Collection, ThemeMode, Wish, WishDraft } from "@/types/wishlist";
import { DEFAULT_DOCK_ORDER } from "@/types/wishlist";

export function useWishlist() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [currency, setCurrency] = useState<Currency>("RUB");
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageRetrying, setStorageRetrying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<PersistentStorageStatus | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const loadGeneration = useRef(0);
  const exportLock = useRef(false);
  const [settings, setSettings] = useState<AppSettings>(() =>
    normalizeSettings({ theme: "system", dockOrder: [...DEFAULT_DOCK_ORDER] }),
  );

  const runLoad = useCallback(async (reopen: boolean) => {
    const generation = ++loadGeneration.current;
    const current = () => generation === loadGeneration.current;
    if (reopen) setStorageRetrying(true);
    try {
      if (reopen) await reopenWishlistDatabase();
      const data = await loadWishlist();
      if (!current()) return;
      setName(data.name);
      setCurrency(data.currency);
      setWishes(data.wishes);
      setCollections(data.collections);
      setMapReady(data.mapReady);
      setSettings(data.settings);
      setLastExportAt(data.lastExportedAt);
      setStorageError(null);
      setReady(true);
      const persistent = await requestPersistentStorage();
      if (!current()) return;
      setPersistence(persistent);
      try {
        await diagnoseStorage();
      } catch (error) {
        console.warn("[Wishlist] storage diagnose failed", error instanceof Error ? error.name : "Error");
      }
    } catch (error) {
      console.warn("[Wishlist] IndexedDB read failed", error instanceof Error ? error.name : "Error");
      if (!current()) return;
      setStorageError(formatStorageError(error));
      setReady(true);
    } finally {
      if (current()) setStorageRetrying(false);
    }
  }, []);

  useEffect(() => {
    void runLoad(false);
  }, [runLoad]);

  const retryLoad = useCallback(() => runLoad(true), [runLoad]);

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

  const changeTheme = useCallback(async (theme: ThemeMode) => {
    setSettings((current) => ({ ...current, theme }));
    try {
      const next = await saveSettings({ theme });
      setSettings(next);
    } catch {
      toast.error("Тема не сохранилась");
    }
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((current) => normalizeSettings({ ...current, ...patch }));
    try {
      const next = await saveSettings(patch);
      setSettings(next);
    } catch {
      toast.error("Настройки не сохранились");
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
        completed: draft.completed,
        order,
        collectionId: draft.collectionId,
        priority: draft.priority,
        savingsEnabled: draft.savingsEnabled,
        targetAmount: draft.savingsEnabled ? price : existing?.targetAmount ?? null,
        savedAmount: Math.max(0, saved),
        deadline: draft.savingsEnabled ? draft.deadline || null : existing?.deadline ?? null,
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
        location: draft.location.trim().slice(0, 200),
        eventDate: draft.eventDate || null,
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
    async (wish: Wish, archivedFlag: boolean, completed = false) => {
      const next = {
        ...wish,
        archived: archivedFlag,
        completed: archivedFlag ? completed : false,
        updatedAt: Date.now(),
      };
      const previous = wishes;
      setWishes((current) => current.map((item) => (item.id === wish.id ? next : item)));
      try {
        await putWish(next);
        toast(archivedFlag ? (completed ? "Исполнено — в архиве" : "В архиве") : "Снова в списке", {
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

  const setCompletedFlag = useCallback(
    async (wish: Wish, completed: boolean) => {
      const next = { ...wish, completed, archived: true, updatedAt: Date.now() };
      const previous = wishes;
      setWishes((current) => current.map((item) => (item.id === wish.id ? next : item)));
      try {
        await putWish(next);
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

  const deleteMany = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const previous = wishes;
      const removed = wishes.filter((w) => idSet.has(w.id));
      setWishes((current) => current.filter((item) => !idSet.has(item.id)));
      try {
        await Promise.all(removed.map((wish) => removeWish(wish.id)));
        toast(`Удалили: ${removed.length}`);
      } catch {
        setWishes(previous);
        toast.error("Не удалось удалить");
      }
    },
    [wishes],
  );

  const archiveMany = useCallback(
    async (ids: string[], completed = false) => {
      const idSet = new Set(ids);
      const previous = wishes;
      const now = Date.now();
      setWishes((current) =>
        current.map((wish) =>
          idSet.has(wish.id) ? { ...wish, archived: true, completed, updatedAt: now } : wish,
        ),
      );
      try {
        await Promise.all(
          wishes
            .filter((wish) => idSet.has(wish.id))
            .map((wish) => putWish({ ...wish, archived: true, completed, updatedAt: now })),
        );
        toast(completed ? "Исполнено" : "В архиве");
      } catch {
        setWishes(previous);
        toast.error("Не получилось");
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

  const exportJson = useCallback(async () => {
    if (exportLock.current) return;
    if (!ready || storageError) {
      toast.error("Список ещё не открыт");
      return;
    }
    exportLock.current = true;
    setExporting(true);
    const toastId = toast.loading("Подготавливаем резервную копию...");
    try {
      const ids = localPhotoIds(wishes, collections);
      const photos: BackupPhoto[] = [];
      let missing = 0;
      let oversized = 0;
      let unreadable = 0;
      for (const id of ids) {
        try {
          const blob = await getPhotoBlob(`idb:${id}`);
          if (!blob) {
            missing += 1;
            continue;
          }
          if (blob.size > MAX_BACKUP_PHOTO_BYTES) {
            oversized += 1;
            continue;
          }
          const dataUrl = await blobToDataUrl(blob);
          if (dataUrl.length > MAX_BACKUP_DATA_URL_CHARS) {
            oversized += 1;
            continue;
          }
          photos.push({ id, mime: blob.type || "image/jpeg", dataUrl });
        } catch (error) {
          console.warn("[Wishlist] photo backup skipped", error instanceof Error ? error.name : "Error");
          unreadable += 1;
        }
      }
      const file = buildBackup(name, wishes, collections, { currency, settings, photos });
      const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFileName(name);
      link.click();
      URL.revokeObjectURL(url);
      const stamp = file.exportedAt;
      try {
        await rememberBackupExport(stamp);
        setLastExportAt(stamp);
      } catch (error) {
        console.warn("[Wishlist] backup stamp failed", error instanceof Error ? error.name : "Error");
      }
      const skipped = missing + oversized + unreadable;
      if (skipped > 0) {
        const parts = [
          missing ? `${missing} не найдено` : "",
          oversized ? `${oversized} слишком большие` : "",
          unreadable ? `${unreadable} не читаются` : "",
        ].filter(Boolean);
        toast.error(`Копия скачана без ${skipped} фото (${parts.join(", ")}). Это не полная копия.`, { id: toastId });
      } else if (photos.length) {
        toast.success(`Резервная копия скачана, вместе с фото: ${photos.length}`, { id: toastId });
      } else {
        toast.success("Резервная копия скачана", { id: toastId });
      }
    } catch (error) {
      console.warn("[Wishlist] backup export failed", error instanceof Error ? error.name : "Error");
      toast.error("Не удалось подготовить резервную копию", { id: toastId });
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  }, [ready, storageError, name, wishes, collections, currency, settings]);

  const importFile = useCallback(async (file: File) => {
    if (!ready) {
      toast.error("Список ещё не открыт");
      return null;
    }
    try {
      const text = await file.text();
      const parsed = parseBackup(JSON.parse(text));
      if (!parsed || !parsed.wishes.length) {
        toast.error("В файле нет хотелок");
        return null;
      }
      return parsed;
    } catch {
      toast.error("Файл не читается или повреждён");
      return null;
    }
  }, [ready]);

  const confirmImport = useCallback(
    async (
      nextName: string | null,
      nextWishes: Wish[],
      nextCollections: Collection[],
      nextSettings?: AppSettings,
      nextCurrency?: Currency,
      nextPhotos: ParsedBackupPhoto[] = [],
    ) => {
      loadGeneration.current += 1;
      const previous = { name, wishes, collections, settings, currency };
      if (nextName?.trim()) setName(nextName.trim());
      setWishes(nextWishes);
      setCollections(nextCollections);
      if (nextSettings) setSettings(nextSettings);
      if (nextCurrency) setCurrency(nextCurrency);
      try {
        await replaceWishlist(nextName, nextWishes, nextCollections, {
          photos: nextPhotos.map((photo) => ({ id: photo.id, blob: photo.blob, mime: photo.mime })),
          currency: nextCurrency,
          settings: nextSettings,
        });
        setStorageError(null);
        const photoNote = nextPhotos.length ? `, фото: ${nextPhotos.length}` : "";
        toast.success(`Список заменён: ${nextWishes.length} ${wishesWord(nextWishes.length)}${photoNote}`);
        return true;
      } catch (error) {
        console.warn("[Wishlist] backup import failed", error instanceof Error ? error.name : "Error");
        setName(previous.name);
        setWishes(previous.wishes);
        setCollections(previous.collections);
        setSettings(previous.settings);
        setCurrency(previous.currency);
        toast.error("Не удалось восстановить копию. Текущие данные не заменены.");
        return false;
      }
    },
    [name, wishes, collections, settings, currency],
  );

  return {
    ready,
    storageError,
    storageRetrying,
    exporting,
    lastExportAt,
    persistence,
    retryLoad,
    mapReady,
    name,
    setName,
    currency,
    wishes,
    collections,
    settings,
    active,
    archived,
    commitName,
    changeCurrency,
    changeTheme,
    updateSettings,
    saveDraft,
    upsertWish,
    persistMapPositions,
    setArchived,
    setCompletedFlag,
    deleteWish,
    deleteMany,
    archiveMany,
    reorder,
    saveCollection,
    deleteCollection,
    exportJson,
    importFile,
    confirmImport,
  };
}
