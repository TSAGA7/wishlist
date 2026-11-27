import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, Coins, ExternalLink, MoreHorizontal, Pencil, Plane, ShoppingBag, Star } from "lucide-react";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import { SavingsPanel } from "@/features/savings/savings-panel";
import { ImageFallback } from "@/features/wishes/thumb";
import { formatMoney } from "@/lib/money";
import { placeholderFor } from "@/services/paths";
import type { Wish } from "@/types/wishlist";

function priorityLabel(wish: Wish): string {
  if (wish.priority === "critical") return "Критический";
  if (wish.priority === "high") return "Высокий";
  if (wish.priority === "medium") return "Средний";
  return "Низкий";
}

function formatDeadline(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function ViewSheet(props: {
  wish: Wish;
  onClose: () => void;
  onEdit: () => void;
  onUpdate: (wish: Wish) => void;
}) {
  return (
    <OverlayFrame onClose={props.onClose} variant="screen">
      <WishScreen {...props} />
    </OverlayFrame>
  );
}

function WishScreen({
  wish,
  onEdit,
  onUpdate,
}: {
  wish: Wish;
  onClose: () => void;
  onEdit: () => void;
  onUpdate: (wish: Wish) => void;
}) {
  const dismiss = useOverlayClose();
  const backRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const deadline = formatDeadline(wish.deadline);
  const cost = wish.price ?? wish.targetAmount;

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="wish-screen" role="dialog" aria-modal="true" aria-labelledby="wish-screen-title">
      <header className="wish-screen__bar">
        <button ref={backRef} type="button" className="wish-screen__back" onClick={() => dismiss?.()} aria-label="Назад">
          <ChevronLeft className="size-5" />
          <span>Назад</span>
        </button>
        <h2 id="wish-screen-title" className="wish-screen__heading">
          {wish.title}
        </h2>
        <button
          type="button"
          className="wish-screen__icon"
          aria-label="Ещё"
          aria-expanded={menu}
          onClick={() => setMenu((open) => !open)}
        >
          <MoreHorizontal className="size-5" />
        </button>
        {menu ? (
          <div className="wish-screen__menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                onEdit();
              }}
            >
              <Pencil className="size-4" /> Редактировать
            </button>
          </div>
        ) : null}
      </header>

      <div className="wish-screen__body">
        <div className="wish-screen__photo">
          {!wish.image ? (
            <img src={placeholderFor(wish.kind)} alt="" />
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
              onError={() => setImgFailed(true)}
            />
          )}
        </div>

        <h1 className="wish-screen__title">{wish.title}</h1>
        <div className="wish-screen__tags">
          <span className="chip">
            {wish.kind === "trip" ? <Plane className="size-3.5" /> : <ShoppingBag className="size-3.5" />}
            {wish.kind === "trip" ? "Поездка" : "Покупка"}
          </span>
          <span className={`chip ${wish.priority === "high" || wish.priority === "critical" ? "chip-hot" : ""}`}>
            <Star className="size-3.5" />
            {priorityLabel(wish)}
          </span>
        </div>

        <div className="wish-screen__stats">
          <div className="wish-stat">
            <Coins className="size-4" />
            <small>Стоимость</small>
            <strong>{cost != null ? formatMoney(cost, wish.currency) : "—"}</strong>
          </div>
          <div className="wish-stat">
            <Calendar className="size-4" />
            <small>Дедлайн</small>
            <strong>{deadline ?? "—"}</strong>
          </div>
        </div>

        <SavingsPanel wish={wish} onChange={onUpdate} always />

        {wish.note ? (
          <div className="wish-note">
            <p>Заметка</p>
            <p>{wish.note}</p>
          </div>
        ) : null}

        {wish.kind === "trip" && (wish.countries.length || wish.cities.length) ? (
          <p className="wish-screen__places">{[...wish.cities, ...wish.countries].join(" · ")}</p>
        ) : null}

        {wish.url ? (
          <a className="wish-screen__link" href={wish.url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Открыть ссылку
          </a>
        ) : null}
      </div>

      <footer className="wish-screen__foot">
        <button type="button" className="save" onClick={onEdit}>
          <Pencil className="size-5" /> Редактировать
        </button>
      </footer>
    </div>
  );
}
