import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  Calendar,
  Check,
  ChevronLeft,
  Coins,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import { useDismissable } from "@/hooks/use-dismissable";
import { SavingsPanel } from "@/features/savings/savings-panel";
import { ImageFallback, Thumb } from "@/features/wishes/thumb";
import { kindLabel } from "@/lib/kinds";
import { formatMoney } from "@/lib/money";
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
  onArchive: () => void;
  onDelete: () => void;
  onComplete: () => void;
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
  onArchive,
  onDelete,
  onComplete,
  onUpdate,
}: {
  wish: Wish;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onUpdate: (wish: Wish) => void;
}) {
  const dismiss = useOverlayClose();
  const backRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useDismissable(menu, () => setMenu(false), menuBtnRef);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const deadline = wish.savingsEnabled ? formatDeadline(wish.deadline) : null;
  const cost = wish.price ?? wish.targetAmount;

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!menu || !menuBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const box = menuBtnRef.current.getBoundingClientRect();
    const width = 192;
    setMenuPos({
      top: Math.min(box.bottom + 6, window.innerHeight - 180),
      left: Math.min(Math.max(8, box.right - width), window.innerWidth - width - 8),
    });
  }, [menu]);

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
          ref={menuBtnRef}
          type="button"
          className="wish-screen__icon"
          aria-label="Ещё"
          aria-expanded={menu}
          onClick={() => setMenu((open) => !open)}
        >
          <MoreHorizontal className="size-5" />
        </button>
        {menu && menuPos
          ? createPortal(
              <div
                ref={menuRef as React.RefObject<HTMLDivElement>}
                className="wish-screen__menu wish-screen__menu--portal"
                role="menu"
                style={{ top: menuPos.top, left: menuPos.left, right: "auto" }}
              >
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onArchive();
                  }}
                >
                  <Archive className="size-4" /> Архивировать
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onDelete();
                  }}
                >
                  <Trash2 className="size-4" /> Удалить
                </button>
              </div>,
              document.body,
            )
          : null}
      </header>

      <div className="wish-screen__body">
        <div className="wish-screen__photo">
          {!wish.image ? (
            <Thumb src={null} kind={wish.kind} className="wish-screen__photo-img" priority />
          ) : imgFailed ? (
            <ImageFallback
              kind={wish.kind}
              onRetry={() => {
                setImgFailed(false);
                setImgKey((k) => k + 1);
              }}
            />
          ) : (
            <Thumb
              key={imgKey}
              src={wish.image}
              kind={wish.kind}
              className="wish-screen__photo-img"
              priority
            />
          )}
        </div>

        <h1 className="wish-screen__title">{wish.title}</h1>
        <div className="wish-screen__tags">
          <span className="chip">{kindLabel(wish.kind)}</span>
          <span className={`chip ${wish.priority === "high" || wish.priority === "critical" ? "chip-hot" : ""}`}>
            {priorityLabel(wish)}
          </span>
        </div>

        <div className="wish-screen__stats">
          <div className="wish-stat">
            <Coins className="size-4" />
            <small>Стоимость</small>
            <strong>{cost != null ? formatMoney(cost, wish.currency) : "—"}</strong>
          </div>
          {wish.savingsEnabled && deadline ? (
            <div className="wish-stat">
              <Calendar className="size-4" />
              <small>Срок</small>
              <strong>{deadline}</strong>
            </div>
          ) : wish.eventDate ? (
            <div className="wish-stat">
              <Calendar className="size-4" />
              <small>Дата</small>
              <strong>{formatDeadline(wish.eventDate) ?? wish.eventDate}</strong>
            </div>
          ) : wish.location ? (
            <div className="wish-stat">
              <small>Локация</small>
              <strong>{wish.location}</strong>
            </div>
          ) : null}
        </div>

        <SavingsPanel wish={wish} onChange={onUpdate} />

        {wish.note ? (
          <div className="wish-note">
            <p>Заметка</p>
            <p>{wish.note}</p>
          </div>
        ) : null}

        {wish.kind === "trip" && (wish.countries.length || wish.cities.length) ? (
          <div className="wish-screen__places">
            {[...wish.cities, ...wish.countries].filter(Boolean).join(" · ")}
          </div>
        ) : null}

        {wish.url ? (
          <a className="wish-screen__link" href={wish.url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Открыть ссылку
          </a>
        ) : null}
      </div>
      <footer className="wish-screen__foot">
        <button type="button" className="save" onClick={onComplete}>
          <Check className="size-5" /> Исполнено
        </button>
      </footer>
    </div>
  );
}
