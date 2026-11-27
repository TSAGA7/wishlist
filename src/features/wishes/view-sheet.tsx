import { useState } from "react";
import { Calendar, ChevronLeft, Coins, MoreHorizontal, Pencil, Plane, ShoppingBag, Star } from "lucide-react";
import { SavingsPanel } from "@/features/savings/savings-panel";
import { ImageFallback, Thumb } from "@/features/wishes/thumb";
import { formatMoney } from "@/lib/money";
import { placeholderFor } from "@/services/paths";
import type { Wish } from "@/types/wishlist";

function priorityLabel(wish: Wish): string {
  if (wish.priority === "critical" || wish.priority === "high") return "Высокий приоритет";
  if (wish.priority === "medium") return "Средний";
  return "Низкий";
}

function formatDeadline(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export function ViewSheet({
  wish,
  onClose,
  onEdit,
  onUpdate,
}: {
  wish: Wish;
  onClose: () => void;
  onEdit: () => void;
  onUpdate: (wish: Wish) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const deadline = formatDeadline(wish.deadline);
  const cost = wish.price ?? wish.targetAmount;

  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet wish-view rise" role="dialog" aria-modal="true">
        <div className="mb-2 flex items-start justify-between gap-3">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Назад">
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="text-xl font-semibold">Хотелка</h2>
          <button type="button" className="icon-btn" onClick={onEdit} aria-label="Меню">
            <MoreHorizontal className="size-5" />
          </button>
        </div>

        <div className="relative mb-4 overflow-hidden rounded-2xl" style={{ aspectRatio: "16/9" }}>
          {!wish.image ? (
            <img src={placeholderFor(wish.kind)} alt="" className="h-full w-full object-cover" />
          ) : imgFailed ? (
            <ImageFallback
              kind={wish.kind}
              onRetry={() => {
                setImgFailed(false);
                setImgKey((k) => k + 1);
              }}
            />
          ) : (
            <img
              key={imgKey}
              src={wish.image}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          )}
        </div>

        <h1 className="text-2xl font-semibold">{wish.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="chip">
            {wish.kind === "trip" ? <Plane className="size-3.5" /> : <ShoppingBag className="size-3.5" />}
            {wish.kind === "trip" ? "Поездка" : "Покупка"}
          </span>
          <span className={`chip ${wish.priority === "high" || wish.priority === "critical" ? "chip-hot" : ""}`}>
            <Star className="size-3.5" />
            {priorityLabel(wish)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="meta-card glass">
            <Coins className="size-4 opacity-70" />
            <small>Стоимость</small>
            <strong>{cost != null ? formatMoney(cost, wish.currency) : "—"}</strong>
          </div>
          <div className="meta-card glass">
            <Calendar className="size-4 opacity-70" />
            <small>Дедлайн</small>
            <strong>{deadline ?? "—"}</strong>
          </div>
        </div>

        <div className="mt-4">
          <SavingsPanel wish={wish} onChange={onUpdate} />
        </div>

        {wish.note ? (
          <div className="mt-4 glass rounded-xl p-3">
            <p className="text-sm text-muted">Заметка</p>
            <p className="mt-1 whitespace-pre-wrap">{wish.note}</p>
          </div>
        ) : null}

        {wish.kind === "trip" && (wish.countries.length || wish.cities.length) ? (
          <p className="mt-2 text-muted">{[...wish.countries, ...wish.cities].join(" · ")}</p>
        ) : null}

        {wish.url ? (
          <a className="mt-3 block text-sm underline" href={wish.url} target="_blank" rel="noreferrer">
            Открыть ссылку
          </a>
        ) : null}

        <button type="button" className="save mt-6" onClick={onEdit}>
          <Pencil className="size-5" /> Редактировать
        </button>
      </div>
    </div>
  );
}

export function WishListThumb({ wish }: { wish: Wish }) {
  return <Thumb src={wish.image || placeholderFor(wish.kind)} kind={wish.kind} />;
}
