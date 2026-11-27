import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Link2, Plane, ShoppingBag, X } from "lucide-react";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import { hostOf } from "@/lib/draft";
import { CURRENCIES, currencyLabel, type Currency } from "@/lib/money";
import { parseProduct } from "@/lib/parse-product";
import { Thumb } from "@/features/wishes/thumb";
import type { Collection, Priority, WishDraft, WishKind } from "@/types/wishlist";

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "low", label: "Низкий" },
  { id: "medium", label: "Средний" },
  { id: "high", label: "Высокий" },
  { id: "critical", label: "Критичный" },
];

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
  const sheetRef = useRef<HTMLDivElement>(null);
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
        setStatus(result.error);
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
          targetAmount:
            takePrice && !current.targetAmount.trim() && result.price != null
              ? String(result.price)
              : current.targetAmount,
        };
      });
      setStatus(hostOf(url) ? `Подтянули со страницы ${hostOf(url)}` : "Подтянули, что нашлось");
    } catch {
      setStatus("Страница не открылась. Можно заполнить вручную");
    } finally {
      setParsing(false);
    }
  }

  function onHandleDown(event: ReactPointerEvent<HTMLDivElement>) {
    const start = event.clientY;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      const dy = Math.max(0, ev.clientY - start);
      if (sheetRef.current && window.innerWidth < 960) sheetRef.current.style.transform = `translateY(${dy}px)`;
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      if (ev.clientY - start > 90) dismiss();
      else if (sheetRef.current) sheetRef.current.style.transform = "";
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  function setKind(kind: WishKind) {
    setForm((current) => ({ ...current, kind }));
  }

  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={dismiss} />
      <div ref={sheetRef} className="sheet rise" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="handle" onPointerDown={onHandleDown} />
        <div className="mb-3 flex items-center justify-between">
          <h2 id="editor-title" className="text-xl font-semibold">
            {form.id ? "Редактировать" : form.kind === "trip" ? "Добавить поездку" : "Добавить покупку"}
          </h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={dismiss}>
            <X className="size-5" />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
        >
          <div className="segment wide">
            <button type="button" aria-pressed={form.kind === "purchase"} onClick={() => setKind("purchase")}>
              <ShoppingBag className="size-4" /> Покупка
            </button>
            <button type="button" aria-pressed={form.kind === "trip"} onClick={() => setKind("trip")}>
              <Plane className="size-4" /> Поездка
            </button>
          </div>

          {form.kind === "purchase" ? (
            <label className="block">
              <span className="label">Ссылка</span>
              <span className="flex gap-2">
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
                  {form.url ? (
                    <button
                      type="button"
                      className="field-clear"
                      aria-label="Очистить ссылку"
                      onClick={() => setForm({ ...form, url: "" })}
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="field w-auto px-4"
                  disabled={parsing}
                  onClick={() => void pull(form.url, true)}
                >
                  {parsing ? "…" : "Найти"}
                </button>
              </span>
              <span className="mt-1 block min-h-5 text-sm text-muted">{status}</span>
            </label>
          ) : null}

          {form.title || form.image ? (
            <div className="found glass">
              <span className="thumb thumb-fallback">
                <Thumb src={form.image} kind={form.kind} />
              </span>
              <span>
                <strong>{form.title || "Без названия"}</strong>
                <span className="block text-sm text-muted">
                  {form.kind === "trip" ? "Поездка" : hostOf(form.url) ?? "Ссылка"}
                </span>
              </span>
            </div>
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

          <div className="grid grid-cols-[1fr_7.5rem] gap-2">
            <label>
              <span className="label">{form.kind === "trip" ? "Бюджет" : "Цена"}</span>
              <input
                inputMode="decimal"
                value={form.price}
                placeholder="0"
                onChange={(event) => setForm({ ...form, price: event.target.value, priceAuto: false })}
                className="field tabular-nums"
              />
            </label>
            <label>
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
            <div className="segment wide">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={form.priority === p.id}
                  onClick={() => setForm({ ...form, priority: p.id })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="label">Цель накопления</span>
              <input
                inputMode="decimal"
                className="field tabular-nums"
                value={form.targetAmount}
                placeholder={form.price || "0"}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Уже накоплено</span>
              <input
                inputMode="decimal"
                className="field tabular-nums"
                value={form.savedAmount}
                onChange={(e) => setForm({ ...form, savedAmount: e.target.value })}
              />
            </label>
          </div>

          <label className="block">
            <span className="label">Дедлайн</span>
            <input
              type="date"
              className="field"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </label>

          {form.kind === "trip" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="label">Страны</span>
                  <input
                    className="field"
                    placeholder="Италия"
                    value={form.countries}
                    onChange={(e) => setForm({ ...form, countries: e.target.value })}
                  />
                </label>
                <label>
                  <span className="label">Города</span>
                  <input
                    className="field"
                    placeholder="Рим, Комо"
                    value={form.cities}
                    onChange={(e) => setForm({ ...form, cities: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="label">Начало</span>
                  <input
                    type="date"
                    className="field"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
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
            <span className="label">URL изображения</span>
            <input
              className="field"
              value={form.image ?? ""}
              placeholder="https://"
              onChange={(e) => setForm({ ...form, image: e.target.value.trim() || null })}
            />
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

          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={form.archived}
            onClick={() => setForm({ ...form, archived: !form.archived })}
          >
            <span>В архив</span>
            <span className="knob-track" data-on={form.archived}>
              <span className="knob" />
            </span>
          </button>

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
