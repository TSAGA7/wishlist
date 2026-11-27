import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast, Toaster } from "sonner";
import { readThemeMode, setTheme } from "@/components/theme-boot";
import { UpdatePrompt } from "@/components/update-prompt";
import { AppDock, SideNav } from "@/components/shell/app-dock";
import { CollectionsScreen } from "@/features/collections/collections-screen";
import { CosmicMap } from "@/features/cosmic/cosmic-map";
import { AddChoiceSheet } from "@/features/wishes/add-choice-sheet";
import { CompletedModal } from "@/features/wishes/completed-modal";
import { EditorSheet } from "@/features/wishes/editor-sheet";
import { ViewSheet } from "@/features/wishes/view-sheet";
import { useAppHeight } from "@/hooks/use-app-height";
import { useWishlist } from "@/hooks/use-wishlist";
import { checkForUpdate, startUpdates } from "@/lib/app-update";
import { draftFromWish, emptyWishDraft } from "@/lib/draft";
import { wishesWord } from "@/lib/money";
import { ArchiveScreen } from "@/screens/archive-screen";
import { CabinetScreen } from "@/screens/cabinet-screen";
import { HomeFab, HomeScreen } from "@/screens/home-screen";
import type { Collection, HomeFilter, Screen, ThemeMode, Wish, WishDraft, WishKind } from "@/types/wishlist";

type Overlay =
  | { kind: "edit"; draft: WishDraft }
  | { kind: "view"; wish: Wish }
  | { kind: "install" }
  | { kind: "import"; name: string | null; wishes: Wish[]; collections: Collection[]; currency?: Wish["currency"]; settings?: import("@/types/wishlist").AppSettings }
  | { kind: "add-choice" }
  | { kind: "completed"; wishes: Wish[] }
  | { kind: "confirm-delete"; wishes: Wish[] }
  | null;

export function WishlistApp() {
  useAppHeight();
  const store = useWishlist();
  const firstTab = store.settings.dockOrder[0] ?? "home";
  const [screen, setScreen] = useState<Screen>(firstTab);
  const [bootedScreen, setBootedScreen] = useState(false);
  const [filter, setFilter] = useState<HomeFilter>("all");
  const [query, setQuery] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [theme, setThemeMode] = useState<ThemeMode>(readThemeMode());
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (import.meta.env.PROD) startUpdates();
  }, []);

  useEffect(() => {
    if (!bootedScreen && store.ready) {
      setScreen(store.settings.dockOrder[0] ?? "home");
      setBootedScreen(true);
    }
  }, [store.ready, store.settings.dockOrder, bootedScreen]);

  async function handleCheckUpdate() {
    const result = await checkForUpdate();
    if (result === "current") toast("Уже последняя версия");
    if (result === "unsupported") toast("Обновление доступно в установленном приложении");
  }

  function applyTheme(mode: ThemeMode) {
    setThemeMode(mode);
    setDark(setTheme(mode));
    void store.changeTheme(mode);
  }

  function openCreate(kind?: WishKind) {
    if (!kind) {
      setOverlay({ kind: "add-choice" });
      return;
    }
    setOverlay({ kind: "edit", draft: emptyWishDraft(store.currency, kind) });
  }

  async function handleImportFile(file: File) {
    const parsed = await store.importFile(file);
    if (parsed) {
      setOverlay({
        kind: "import",
        name: parsed.name,
        wishes: parsed.wishes,
        collections: parsed.collections,
        currency: parsed.currency,
        settings: parsed.settings,
      });
    }
  }

  function navigate(next: Screen) {
    setSelectMode(false);
    setSelectedIds(new Set());
    setScreen(next);
  }

  const mapMode = screen === "map";
  const overlayOpen = overlay !== null;

  useEffect(() => {
    if (!overlayOpen) return;
    history.pushState({ wishlistOverlay: true }, "");
    let fromHistory = false;
    const onPop = () => {
      fromHistory = true;
      setOverlay(null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      const state = history.state as { wishlistOverlay?: boolean } | null;
      if (!fromHistory && state?.wishlistOverlay) history.back();
    };
  }, [overlayOpen]);

  function requestComplete(wishes: Wish[]) {
    if (!wishes.length) return;
    setOverlay({ kind: "completed", wishes });
  }

  function requestDelete(wishes: Wish[]) {
    if (!wishes.length) return;
    setOverlay({ kind: "confirm-delete", wishes });
  }

  return (
    <div className={`shell ${mapMode ? "shell-map" : ""} ${overlayOpen ? "shell-locked" : ""}`}>
      <SideNav
        screen={screen}
        order={store.settings.dockOrder}
        counts={{
          wishes: store.wishes.filter((w) => !w.archived).length,
          archive: store.archived.length,
          collections: store.collections.length,
        }}
        onNavigate={navigate}
      />

      {mapMode ? (
        <div className="map-pane">
          <CosmicMap
            wishes={store.wishes}
            ready={store.ready}
            mapReady={store.mapReady}
            showAdd={!overlay}
            onOpen={(wish) => setOverlay({ kind: "view", wish })}
            onAdd={() => openCreate()}
            onPersistPositions={store.persistMapPositions}
          />
        </div>
      ) : (
        <div className={`stage ${screen === "home" ? "" : "stage-plain"}`}>
          {screen === "home" ? (
            <HomeScreen
              name={store.name}
              wishes={store.wishes}
              query={query}
              filter={filter}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onQuery={setQuery}
              onFilter={setFilter}
              onOpen={(wish) => setOverlay({ kind: "view", wish })}
              onEdit={(wish) => setOverlay({ kind: "edit", draft: draftFromWish(wish) })}
              onComplete={(wish) => requestComplete([wish])}
              onArchive={(wish) => void store.setArchived(wish, true, false)}
              onDelete={(wish) => requestDelete([wish])}
              onReorder={(ids) => void store.reorder(ids)}
              onRename={(next) => void store.commitName(next)}
              onAdd={() => openCreate()}
              onSelectMode={(value) => {
                setSelectMode(value);
                if (!value) setSelectedIds(new Set());
              }}
              onToggleSelect={(wish) => {
                setSelectedIds((current) => {
                  const next = new Set(current);
                  if (next.has(wish.id)) next.delete(wish.id);
                  else next.add(wish.id);
                  return next;
                });
              }}
              onSelectAll={() => {
                setSelectedIds(new Set(store.wishes.filter((w) => !w.archived).map((w) => w.id)));
              }}
              onClearSelection={() => setSelectedIds(new Set())}
              onBulkComplete={() => {
                const selected = store.wishes.filter((w) => selectedIds.has(w.id));
                requestComplete(selected);
              }}
              onBulkArchive={() => {
                void store.archiveMany([...selectedIds], false).then(() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                });
              }}
              onBulkDelete={() => {
                const selected = store.wishes.filter((w) => selectedIds.has(w.id));
                requestDelete(selected);
              }}
            />
          ) : null}

          {screen === "archive" ? (
            <ArchiveScreen
              items={[...store.archived].sort((a, b) => b.updatedAt - a.updatedAt)}
              onOpen={(wish) => setOverlay({ kind: "view", wish })}
              onRestore={(wish) => void store.setArchived(wish, false)}
              onToggleCompleted={(wish) => void store.setCompletedFlag(wish, !wish.completed)}
              onDelete={(wish) => requestDelete([wish])}
            />
          ) : null}

          {screen === "cabinet" ? (
            <CabinetScreen
              theme={theme}
              currency={store.currency}
              dockOrder={store.settings.dockOrder}
              onTheme={applyTheme}
              onCurrency={(value) => void store.changeCurrency(value)}
              onDockOrder={(order) => void store.changeDockOrder(order)}
              onExport={store.exportJson}
              onImport={() => fileRef.current?.click()}
              onInstall={() => setOverlay({ kind: "install" })}
              onCheckUpdate={() => void handleCheckUpdate()}
            />
          ) : null}

          {screen === "collections" ? (
            <CollectionsScreen
              collections={store.collections}
              wishes={store.wishes}
              onBack={() => navigate("home")}
              onSave={store.saveCollection}
              onDelete={store.deleteCollection}
              onOpenWish={(wish) => setOverlay({ kind: "view", wish })}
            />
          ) : null}

          {screen === "home" && !overlay && !selectMode ? <HomeFab onClick={() => openCreate()} /> : null}
        </div>
      )}

      <AppDock screen={screen} order={store.settings.dockOrder} onNavigate={navigate} />

      {overlay?.kind === "add-choice" ? (
        <AddChoiceSheet
          onClose={() => setOverlay(null)}
          onPick={(kind) => setOverlay({ kind: "edit", draft: emptyWishDraft(store.currency, kind) })}
        />
      ) : null}

      {overlay?.kind === "view" ? (
        <ViewSheet
          wish={overlay.wish}
          onClose={() => setOverlay(null)}
          onEdit={() => setOverlay({ kind: "edit", draft: draftFromWish(overlay.wish) })}
          onArchive={() => {
            void store.setArchived(overlay.wish, true, false);
            setOverlay(null);
          }}
          onDelete={() => requestDelete([overlay.wish])}
          onUpdate={(updated) => {
            void store.upsertWish(updated);
            setOverlay({ kind: "view", wish: updated });
          }}
        />
      ) : null}

      {overlay?.kind === "edit" ? (
        <EditorSheet
          draft={overlay.draft}
          collections={store.collections}
          onClose={() => setOverlay(null)}
          onSave={(draft) => {
            void store.saveDraft(draft).then((ok) => {
              if (ok) setOverlay(null);
            });
          }}
        />
      ) : null}

      {overlay?.kind === "completed" ? (
        <CompletedModal
          onClose={() => setOverlay(null)}
          onArchive={() => {
            const ids = overlay.wishes.map((w) => w.id);
            void store.archiveMany(ids, true).then(() => {
              setOverlay(null);
              setSelectMode(false);
              setSelectedIds(new Set());
            });
          }}
          onDelete={() => setOverlay({ kind: "confirm-delete", wishes: overlay.wishes })}
        />
      ) : null}

      {overlay?.kind === "install" ? <InstallSheet onClose={() => setOverlay(null)} /> : null}

      {overlay?.kind === "import" ? (
        <ConfirmSheet
          title="Заменить список?"
          body={`В файле ${overlay.wishes.length} ${wishesWord(overlay.wishes.length)} и ${overlay.collections.length} подборок. Текущие данные на этом устройстве будут заменены.`}
          confirmLabel="Заменить"
          onClose={() => setOverlay(null)}
          onConfirm={() => {
            void store
              .confirmImport(overlay.name, overlay.wishes, overlay.collections, overlay.settings, overlay.currency)
              .then((ok) => {
                if (ok) setOverlay(null);
              });
          }}
        />
      ) : null}

      {overlay?.kind === "confirm-delete" ? (
        <ConfirmSheet
          title={overlay.wishes.length > 1 ? `Удалить ${overlay.wishes.length}?` : "Удалить желание?"}
          body="Это действие можно будет отменить сразу после удаления."
          confirmLabel="Удалить"
          danger
          onClose={() => setOverlay(null)}
          onConfirm={() => {
            void store.deleteMany(overlay.wishes.map((w) => w.id)).then(() => {
              setOverlay(null);
              setSelectMode(false);
              setSelectedIds(new Set());
            });
          }}
        />
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleImportFile(file);
        }}
      />

      <UpdatePrompt />

      <Toaster
        position="top-center"
        theme={dark ? "dark" : "light"}
        toastOptions={{
          style: {
            background: "rgba(20,24,36,0.92)",
            color: "#f5f7fb",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "16px",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </div>
  );
}

function InstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">Добавить на экран «Домой»?</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <p className="text-muted">
          Установите Wishlist как приложение на iPhone: Safari → Поделиться → На экран «Домой».
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Откройте сайт в Safari</li>
          <li>Нажмите «Поделиться»</li>
          <li>Выберите «На экран „Домой“»</li>
        </ol>
        <button type="button" className="save mt-4" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}

function ConfirmSheet({
  title,
  body,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-muted">{body}</p>
        <button type="button" className={`save mt-4 ${danger ? "save-danger" : ""}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
