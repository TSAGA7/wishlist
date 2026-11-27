import { useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  Check,
  ImagePlus,
  Link2,
  MapPin,
  Plane,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import { putPhoto, removePhoto } from "@/database/wishlist-db";
import { Thumb } from "@/features/wishes/thumb";
import { hostOf } from "@/lib/draft";
import { kindLabel } from "@/lib/kinds";
import { CURRENCIES, currencyLabel, type Currency } from "@/lib/money";
import { parseProduct } from "@/lib/parse-product";
import type { Collection, Priority, WishDraft, WishKind } from "@/types/wishlist";

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "low", label: "Низкий" },
  { id: "medium", label: "Средний" },
  { id: "high", label: "Высокий" },
  { id: "critical", label: "Критичный" },
];

const KIND_ICONS: Record<WishKind, typeof ShoppingBag> = {
  purchase: ShoppingBag,
  trip: Plane,
  venue: UtensilsCrossed,
  place: MapPin,
  event: CalendarDays,
};

export function EditorSheet(props: {
  draft: WishDraft;
  collections: Collection[];
  onClose: () => void;
  onSave: (draft: WishDraft) => void;
}) {
  return (
    <OverlayFrame onClose={props.onClose} variant="sheet">
      <EditorSheetBody {...props} />
    </OverlayFrame>
  );
}

function EditorSheetBody({
  draft,
  collections,
  onClose,
  onSave,
}: {
  draft: WishDraft;
  collections: Collection[];
  onClose: () => void;
  onSave: (draft: WishDraft) => void;
}) {
  const dismiss = useOverlayClose() ?? onClose;
  const [form, setForm] = useState(draft);
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastParsed = useRef("");

  async function pull(raw: string, force: boolean) {
    const url = raw.trim();
    if (!url) {
      setStatus("Вставьте ссылку или заполните поля сами");
      return;
    }
    if (!force && url === lastParsed.current) return;
    setParsing(true);
    setStatus("Смотрим страницу…");
    try {
      const result = await parseProduct({ data: { url } });
      lastParsed.current = url;
      if (result.error) {
        setStatus("Не удалось прочитать страницу. Можно заполнить вручную");
        return;
      }
      if (!result.title && result.price == null && !result.image) {
        setStatus("На странице нет названия и цены — впишите их сами");
        return;
      }
      setForm((current) => {
        const takePrice = result.price != null && (force || !current.price.trim());
        return {
          ...current,
          url: current.url.trim() ? current.url : url,
          title: result.title && (force || !current.title.trim()) ? result.title : current.title,
          price: takePrice ? String(result.price) : current.price,
          currency: result.currency && takePrice ? result.currency : current.currency,
          image: result.image && (force || !current.image) ? result.image : current.image,
          priceAuto: takePrice ? true : current.priceAuto,
        };
      });
      setStatus(hostOf(url) ? `Подтянули со страницы ${hostOf(url)}` : "Подтянули, что нашлось");
    } catch {
      setStatus("Страница не открылась. Можно заполнить вручную");
    } finally {
      setParsing(false);
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      if (form.image?.startsWith("idb:")) await removePhoto(form.image);
      const ref = await putPhoto(file);
      setForm((current) => ({ ...current, image: ref }));
      setStatus("Фотография добавлена");
    } catch {
      setStatus("Не удалось сохранить фотографию");
    }
  }

  async function clearImage() {
    if (form.image?.startsWith("idb:")) await removePhoto(form.image);
    setForm((current) => ({ ...current, image: null }));
  }

  const showLink = form.kind === "purchase" || form.kind === "venue" || form.kind === "event";

  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={dismiss} />
      <div className="sheet rise editor-sheet" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="editor-title" className="text-xl font-semibold">
            {form.id ? "Редактировать" : `Добавить · ${kindLabel(form.kind)}`}
          </h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={dismiss}>
            <X className="size-5" />
          </button>
        </div>

        <form
          className="editor-form space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              ...form,
              savedAmount: form.savingsEnabled ? form.savedAmount || "0" : form.savedAmount || "0",
            });
          }}
        >
          <div className="kind-scroll">
            {(Object.keys(KIND_ICONS) as WishKind[]).map((kind) => {
              const Icon = KIND_ICONS[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  className="kind-chip"
                  aria-pressed={form.kind === kind}
                  onClick={() => setForm((current) => ({ ...current, kind }))}
                >
                  <Icon className="size-4" /> {kindLabel(kind)}
                </button>
              );
            })}
          </div>

          {showLink ? (
            <label className="block">
              <span className="label">Ссылка</span>
              <span className="link-row">
                <span className="relative min-w-0 flex-1">
                  <Link2 className="pointer-events-none absolute top-3.5 left-3 size-4 opacity-60" />
                  <input
                    value={form.url}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="https://"
                    onChange={(event) => setForm({ ...form, url: event.target.value })}
                    onBlur={() => {
                      if (form.url.trim()) void pull(form.url, false);
                    }}
                    onPaste={(event) => {
                      const text = event.clipboardData.getData("text");
                      if (text.trim()) void pull(text, false);
                    }}
                    className="field url-field"
                  />
                </span>
                <button
                  type="button"
                  className="find-btn"
                  disabled={parsing}
                  onClick={() => void pull(form.url, true)}
                >
                  {parsing ? "…" : "Найти"}
                </button>
              </span>
              <span className="mt-1 block min-h-5 text-sm text-muted">{status}</span>
            </label>
          ) : null}

          <label className="block">
            <span className="label">Название</span>
            <input
              required
              value={form.title}
              maxLength={180}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="field"
            />
          </label>

          <div className="photo-block">
            <span className="label">Фотография</span>
            <div className="photo-preview glass">
              <span className="thumb thumb-fallback photo-preview__img">
                <Thumb src={form.image} kind={form.kind} priority />
              </span>
              <div className="photo-preview__actions">
                <button type="button" className="find-btn" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="size-4" /> {form.image ? "Изменить" : "Добавить"}
                </button>
                {form.image ? (
                  <button type="button" className="icon-btn" aria-label="Удалить фото" onClick={() => void clearImage()}>
                    <Trash2 className="size-4" />
                  </button>
                ) : (
                  <span className="text-sm text-muted inline-flex items-center gap-1">
                    <Camera className="size-3.5" /> или из ссылки
                  </span>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onPickFile(file);
              }}
            />
          </div>

          <div className="price-row">
            <label className="min-w-0 flex-1">
              <span className="label">{form.kind === "trip" ? "Бюджет" : "Цена"}</span>
              <input
                inputMode="decimal"
                value={form.price}
                placeholder="0"
                onChange={(event) => setForm({ ...form, price: event.target.value, priceAuto: false })}
                className="field tabular-nums"
              />
            </label>
            <label className="currency-field">
              <span className="label">Валюта</span>
              <select
                className="field"
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value as Currency })}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {currencyLabel(code)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="label">Приоритет</span>
            <div className="priority-row">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`priority-chip priority-${p.id}`}
                  aria-pressed={form.priority === p.id}
                  onClick={() => setForm({ ...form, priority: p.id })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </label>

          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={form.savingsEnabled}
            onClick={() =>
              setForm((current) => ({
                ...current,
                savingsEnabled: !current.savingsEnabled,
                savedAmount: current.savedAmount || "0",
              }))
            }
          >
            <span>Копить</span>
            <span className="knob-track" data-on={form.savingsEnabled}>
              <span className="knob" />
            </span>
          </button>

          {form.savingsEnabled ? (
            <div className="savings-fields">
              <label>
                <span className="label">Уже накоплено</span>
                <input
                  inputMode="decimal"
                  className="field tabular-nums"
                  value={form.savedAmount}
                  placeholder="0"
                  onChange={(e) => setForm({ ...form, savedAmount: e.target.value })}
                />
              </label>
              <label>
                <span className="label">Срок</span>
                <input
                  type="date"
                  className="field"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          {form.kind === "trip" ? (
            <>
              <div className="price-row">
                <label className="min-w-0 flex-1">
                  <span className="label">Страны</span>
                  <input
                    className="field"
                    placeholder="Италия"
                    value={form.countries}
                    onChange={(e) => setForm({ ...form, countries: e.target.value })}
                  />
                </label>
                <label className="min-w-0 flex-1">
                  <span className="label">Города</span>
                  <input
                    className="field"
                    placeholder="Рим, Комо"
                    value={form.cities}
                    onChange={(e) => setForm({ ...form, cities: e.target.value })}
                  />
                </label>
              </div>
              <div className="price-row">
                <label className="min-w-0 flex-1">
                  <span className="label">Начало</span>
                  <input
                    type="date"
                    className="field"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label className="min-w-0 flex-1">
                  <span className="label">Конец</span>
                  <input
                    type="date"
                    className="field"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </label>
              </div>
            </>
          ) : null}

          {form.kind === "venue" || form.kind === "place" ? (
            <label className="block">
              <span className="label">Адрес / локация</span>
              <input
                className="field"
                value={form.location}
                placeholder="Город, район или адрес"
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
          ) : null}

          {form.kind === "event" ? (
            <label className="block">
              <span className="label">Дата события</span>
              <input
                type="date"
                className="field"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="label">Подборка</span>
            <select
              className="field"
              value={form.collectionId ?? ""}
              onChange={(e) => setForm({ ...form, collectionId: e.target.value || null })}
            >
              <option value="">Без подборки</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Заметка</span>
            <textarea
              value={form.note}
              maxLength={500}
              rows={3}
              placeholder="Для себя"
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              className="field"
            />
          </label>

          <button type="submit" className="save">
            <Check className="size-5" /> Сохранить
          </button>
          <button type="button" className="cancel" onClick={dismiss}>
            Отмена
          </button>
        </form>
      </div>
    </div>
  );
}
