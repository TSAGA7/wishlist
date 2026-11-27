import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast, Toaster } from "sonner";
import { setTheme } from "@/components/theme-boot";
import { UpdatePrompt } from "@/components/update-prompt";
import { AppDock, SideNav } from "@/components/shell/app-dock";
import { CollectionsScreen } from "@/features/collections/collections-screen";
import { CosmicMap } from "@/features/cosmic/cosmic-map";
import { AddChoiceSheet } from "@/features/wishes/add-choice-sheet";
import { EditorSheet } from "@/features/wishes/editor-sheet";
import { ViewSheet } from "@/features/wishes/view-sheet";
import { useWishlist } from "@/hooks/use-wishlist";
import { checkForUpdate, startUpdates } from "@/lib/app-update";
import { draftFromWish, emptyWishDraft } from "@/lib/draft";
import { wishesWord } from "@/lib/money";
import { ArchiveScreen } from "@/screens/archive-screen";
import { BackupsScreen } from "@/screens/backups-screen";
import { HomeFab, HomeScreen } from "@/screens/home-screen";
import { SettingsScreen } from "@/screens/settings-screen";
import type { Collection, HomeFilter, Screen, Wish, WishDraft, WishKind } from "@/types/wishlist";

type Overlay =
  | { kind: "edit"; draft: WishDraft }
  | { kind: "view"; wish: Wish }
  | { kind: "install" }
  | { kind: "import"; name: string | null; wishes: Wish[]; collections: Collection[] }
  | { kind: "add-choice" }
  | null;

export function WishlistApp() {
  const store = useWishlist();
  const [screen, setScreen] = useState<Screen>("map");
  const [filter, setFilter] = useState<HomeFilter>("all");
  const [query, setQuery] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [dark, setDark] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    if (import.meta.env.PROD) startUpdates();
  }, []);

  async function handleCheckUpdate() {
    const result = await checkForUpdate();
    if (result === "current") toast("Уже последняя версия");
    if (result === "unsupported") toast("Обновление доступно в установленном приложении");
  }

  function applyTheme(mode: "light" | "dark") {
    setDark(setTheme(mode));
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
      });
    }
  }

  const showDock = screen !== "settings";
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

  return (
    <div className={`shell ${mapMode ? "shell-map" : ""} ${overlayOpen ? "shell-locked" : ""}`}>
      <SideNav
        screen={screen}
        counts={{
          wishes: store.wishes.length,
          archive: store.archived.length,
          collections: store.collections.length,
        }}
        onNavigate={setScreen}
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
            onSettings={() => setScreen("settings")}
            onPersistPositions={store.persistMapPositions}
          />
        </div>
      ) : (
        <div className={screen === "home" ? "stage" : "stage stage-plain"}>
          {screen === "home" ? (
            <HomeScreen
              name={store.name}
              wishes={store.wishes}
              query={query}
              filter={filter}
              onQuery={setQuery}
              onFilter={setFilter}
              onSettings={() => setScreen("settings")}
              onOpen={(wish) => setOverlay({ kind: "view", wish })}
              onArchive={(wish) => void store.setArchived(wish, !wish.archived)}
              onDelete={(wish) => void store.deleteWish(wish)}
              onReorder={(ids) => void store.reorder(ids)}
              onRename={(next) => void store.commitName(next)}
              onAdd={() => openCreate()}
            />
          ) : null}

          {screen === "archive" ? (
            <ArchiveScreen
              items={[...store.archived].sort((a, b) => b.updatedAt - a.updatedAt)}
              onBack={() => setScreen("home")}
              onOpen={(wish) => setOverlay({ kind: "view", wish })}
              onRestore={(wish) => void store.setArchived(wish, false)}
              onDelete={(wish) => void store.deleteWish(wish)}
            />
          ) : null}

          {screen === "settings" ? (
            <SettingsScreen
              dark={dark}
              currency={store.currency}
              onTheme={applyTheme}
              onCurrency={(value) => void store.changeCurrency(value)}
              onExport={store.exportJson}
              onImport={() => fileRef.current?.click()}
              onInstall={() => setOverlay({ kind: "install" })}
              onCheckUpdate={() => void handleCheckUpdate()}
              onBack={() => setScreen("home")}
              onMap={() => setScreen("map")}
            />
          ) : null}

          {screen === "backups" ? (
            <BackupsScreen
              count={store.wishes.length}
              onBack={() => setScreen("home")}
              onExport={store.exportJson}
              onImport={() => fileRef.current?.click()}
            />
          ) : null}

          {screen === "collections" ? (
            <CollectionsScreen
              collections={store.collections}
              wishes={store.wishes}
              onBack={() => setScreen("home")}
              onSave={store.saveCollection}
              onDelete={store.deleteCollection}
              onOpenWish={(wish) => setOverlay({ kind: "view", wish })}
            />
          ) : null}

          {screen === "home" && !overlay ? <HomeFab onClick={() => openCreate()} /> : null}
        </div>
      )}

      {showDock ? <AppDock screen={screen} onNavigate={setScreen} /> : null}

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

      {overlay?.kind === "install" ? <InstallSheet onClose={() => setOverlay(null)} /> : null}

      {overlay?.kind === "import" ? (
        <ConfirmSheet
          title="Заменить список?"
          body={`В файле ${overlay.wishes.length} ${wishesWord(overlay.wishes.length)} и ${overlay.collections.length} подборок. Текущие данные на этом устройстве будут заменены.`}
          onClose={() => setOverlay(null)}
          onConfirm={() => {
            void store.confirmImport(overlay.name, overlay.wishes, overlay.collections).then((ok) => {
              if (ok) setOverlay(null);
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
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-muted">{body}</p>
        <button type="button" className="save mt-4" onClick={onConfirm}>
          Заменить
        </button>
        <button type="button" className="cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
