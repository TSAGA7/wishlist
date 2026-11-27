import { useMemo, useState } from "react";
import { ChevronLeft, Folder, Plus, Trash2, X } from "lucide-react";
import { formatMoney, goodsWord } from "@/lib/money";
import { emptyCollectionDraft } from "@/lib/draft";
import {
  COLLECTION_COLORS,
  COLLECTION_ICONS,
  type Collection,
  type CollectionDraft,
  type Wish,
} from "@/types/wishlist";
import { Thumb } from "@/features/wishes/thumb";

export function CollectionsScreen({
  collections,
  wishes,
  onBack,
  onSave,
  onDelete,
  onOpenWish,
}: {
  collections: Collection[];
  wishes: Wish[];
  onBack: () => void;
  onSave: (collection: Collection) => Promise<boolean>;
  onDelete: (collection: Collection) => Promise<void>;
  onOpenWish: (wish: Wish) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CollectionDraft | null>(null);

  const selected = collections.find((c) => c.id === selectedId) ?? null;
  const selectedWishes = useMemo(
    () => wishes.filter((w) => !w.archived && w.collectionId === selectedId).sort((a, b) => a.order - b.order),
    [wishes, selectedId],
  );

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    selectedWishes.forEach((w) => {
      if (w.price == null) return;
      byCurrency.set(w.currency, (byCurrency.get(w.currency) ?? 0) + w.price);
    });
    return [...byCurrency.entries()];
  }, [selectedWishes]);

  async function submitDraft(draft: CollectionDraft) {
    const title = draft.title.trim();
    if (!title) return;
    const now = Date.now();
    const existing = draft.id ? collections.find((c) => c.id === draft.id) : undefined;
    const collection: Collection = {
      id: draft.id ?? crypto.randomUUID(),
      title: title.slice(0, 80),
      description: draft.description.trim().slice(0, 300),
      icon: draft.icon || "folder",
      color: draft.color || "#7c6af7",
      coverImage: draft.coverImage,
      order: existing?.order ?? collections.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const ok = await onSave(collection);
    if (ok) {
      setEditing(null);
      setSelectedId(collection.id);
    }
  }

  if (editing) {
    return (
      <CollectionEditor
        draft={editing}
        onClose={() => setEditing(null)}
        onSave={(d) => void submitDraft(d)}
      />
    );
  }

  if (selected) {
    return (
      <section>
        <div className="page-head mobile-only">
          <button type="button" className="icon-btn" aria-label="Назад" onClick={() => setSelectedId(null)}>
            <ChevronLeft className="size-5" />
          </button>
          <h1>{selected.title}</h1>
          <button
            type="button"
            className="icon-btn"
            aria-label="Редактировать"
            onClick={() =>
              setEditing({
                id: selected.id,
                title: selected.title,
                description: selected.description,
                icon: selected.icon,
                color: selected.color,
                coverImage: selected.coverImage,
              })
            }
          >
            <Folder className="size-5" />
          </button>
        </div>

        <div
          className="collection-hero glass"
          style={{
            background: selected.coverImage
              ? undefined
              : `linear-gradient(135deg, ${selected.color}88, rgba(20,24,36,0.7))`,
          }}
        >
          {selected.coverImage ? <img src={selected.coverImage} alt="" /> : null}
          <div className="collection-hero-copy">
            <h2>{selected.title}</h2>
            <p>
              {selectedWishes.length} {goodsWord(selectedWishes.length)}
              {totals[0] ? ` · ~ ${formatMoney(totals[0][1], totals[0][0] as "RUB" | "USD" | "EUR")}` : ""}
            </p>
            {selected.description ? <p className="opacity-80">{selected.description}</p> : null}
          </div>
        </div>

        <div className="cards mt-3">
          {selectedWishes.length === 0 ? (
            <div className="empty-card glass">
              <strong>Пока пусто</strong>
              <p>Добавьте хотелки в эту подборку через редактор.</p>
            </div>
          ) : (
            selectedWishes.map((wish) => (
              <button key={wish.id} type="button" className="wish glass" onClick={() => onOpenWish(wish)}>
                <span className="thumb thumb-fallback">
                  <Thumb src={wish.image} kind={wish.kind} />
                </span>
                <span className="wish-copy">
                  <strong>{wish.title}</strong>
                  <span className="wish-price">
                    {wish.price == null ? "Без цены" : formatMoney(wish.price, wish.currency)}
                    <span className="badge">{wish.kind === "trip" ? "Поездка" : "Покупка"}</span>
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="save"
            onClick={() =>
              setEditing({
                id: selected.id,
                title: selected.title,
                description: selected.description,
                icon: selected.icon,
                color: selected.color,
                coverImage: selected.coverImage,
              })
            }
          >
            Редактировать
          </button>
          <button
            type="button"
            className="row glass justify-center text-[var(--danger)]"
            onClick={() => {
              if (confirm("Удалить подборку? Желания останутся без неё.")) {
                void onDelete(selected).then(() => setSelectedId(null));
              }
            }}
          >
            <Trash2 className="size-4" /> Удалить
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head mobile-only">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Подборки</h1>
        <button
          type="button"
          className="icon-btn"
          aria-label="Создать"
          onClick={() => setEditing(emptyCollectionDraft())}
        >
          <Plus className="size-5" />
        </button>
      </div>

      <div className="desktop-toolbar">
        <h1>Подборки</h1>
        <button type="button" className="add-desktop" onClick={() => setEditing(emptyCollectionDraft())}>
          <Plus className="size-4" /> Создать
        </button>
      </div>

      <div className="cards">
        {collections.length === 0 ? (
          <div className="empty-card glass">
            <strong>Нет подборок</strong>
            <p>Сгруппируйте покупки и поездки по темам — Техника, Путешествия и другие.</p>
            <button type="button" className="save mt-3" onClick={() => setEditing(emptyCollectionDraft())}>
              Создать подборку
            </button>
          </div>
        ) : (
          collections.map((collection) => {
            const count = wishes.filter((w) => !w.archived && w.collectionId === collection.id).length;
            return (
              <button
                key={collection.id}
                type="button"
                className="wish glass"
                onClick={() => setSelectedId(collection.id)}
              >
                <span
                  className="thumb thumb-fallback"
                  style={{ background: `${collection.color}33`, color: collection.color }}
                >
                  {collection.coverImage ? (
                    <img src={collection.coverImage} alt="" className="thumb" />
                  ) : (
                    <Folder className="size-5" />
                  )}
                </span>
                <span className="wish-copy">
                  <strong>{collection.title}</strong>
                  <span className="wish-price">
                    {count} {goodsWord(count)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function CollectionEditor({
  draft,
  onClose,
  onSave,
}: {
  draft: CollectionDraft;
  onClose: () => void;
  onSave: (draft: CollectionDraft) => void;
}) {
  const [form, setForm] = useState(draft);
  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet rise" role="dialog" aria-modal="true">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{form.id ? "Редактировать подборку" : "Новая подборка"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <label className="block">
            <span className="label">Название</span>
            <input
              required
              className="field"
              maxLength={80}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Описание</span>
            <textarea
              className="field"
              rows={3}
              maxLength={300}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Обложка (URL)</span>
            <input
              className="field"
              value={form.coverImage ?? ""}
              onChange={(e) => setForm({ ...form, coverImage: e.target.value.trim() || null })}
            />
          </label>
          <div>
            <span className="label">Цвет</span>
            <div className="color-row">
              {COLLECTION_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-dot ${form.color === color ? "active" : ""}`}
                  style={{ background: color }}
                  aria-label={color}
                  onClick={() => setForm({ ...form, color })}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="label">Иконка</span>
            <div className="segment wide" style={{ flexWrap: "wrap" }}>
              {COLLECTION_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  aria-pressed={form.icon === icon}
                  onClick={() => setForm({ ...form, icon })}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="save">
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
}
