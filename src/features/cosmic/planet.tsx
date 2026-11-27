import { Calendar, Flame, Plane, ShoppingBag, Target } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { placeholderFor } from "@/services/paths";
import type { PlanetPose } from "@/features/cosmic/layout";
import type { Wish } from "@/types/wishlist";

function priorityLabel(wish: Wish): { text: string; hot: boolean } {
  if (wish.priority === "critical" || wish.priority === "high") return { text: "Высокий", hot: true };
  if (wish.priority === "medium") return { text: "Средний", hot: false };
  return { text: "Низкий", hot: false };
}

function formatDeadline(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export function CosmicPlanet({
  wish,
  pose,
  onOpen,
}: {
  wish: Wish;
  pose: PlanetPose;
  onOpen: (wish: Wish) => void;
}) {
  const target = wish.targetAmount ?? wish.price;
  const progress =
    target && target > 0 ? Math.min(100, Math.round((wish.savedAmount / target) * 100)) : 0;
  const pri = priorityLabel(wish);
  const deadline = formatDeadline(wish.deadline);
  const subtitle =
    wish.kind === "trip"
      ? [...wish.cities, ...wish.countries].filter(Boolean).slice(0, 3).join(" · ") || wish.note.slice(0, 40)
      : wish.note.slice(0, 40);
  const img = wish.image || placeholderFor(wish.kind);
  const showRing = wish.priority === "critical" || wish.priority === "high" || progress >= 70;

  return (
    <button
      type="button"
      className={`cosmic-planet ${showRing ? "has-ring" : ""}`}
      style={{
        left: pose.x,
        top: pose.y,
        width: pose.size,
        height: pose.size,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(wish);
      }}
    >
      {showRing ? <span className="cosmic-planet-ring" aria-hidden="true" /> : null}
      <span className="cosmic-planet-orb">
        <img src={img} alt="" className="cosmic-planet-photo" draggable={false} />
        <span className="cosmic-planet-shade" aria-hidden="true" />
        <span className="cosmic-planet-glow" aria-hidden="true" />
        <span className="cosmic-planet-content">
          <span className="cosmic-planet-top">
            <span className="cosmic-planet-kind" aria-hidden="true">
              {wish.kind === "trip" ? <Plane className="size-3" /> : <ShoppingBag className="size-3" />}
            </span>
            <span className={`cosmic-planet-priority ${pri.hot ? "hot" : ""}`}>
              {pri.hot ? <Flame className="size-2.5" /> : <Target className="size-2.5" />}
              {pri.text}
            </span>
          </span>
          <strong className="cosmic-planet-title">{wish.title}</strong>
          {subtitle ? <span className="cosmic-planet-sub">{subtitle}</span> : null}
          {target != null ? (
            <span className="cosmic-planet-money">
              {wish.savedAmount > 0
                ? `${formatMoney(wish.savedAmount, wish.currency)} из ${formatMoney(target, wish.currency)}`
                : formatMoney(target, wish.currency)}
            </span>
          ) : wish.price != null ? (
            <span className="cosmic-planet-money">{formatMoney(wish.price, wish.currency)}</span>
          ) : null}
          {progress > 0 ? (
            <span className="cosmic-planet-progress">
              <span className="track">
                <span className="fill" style={{ width: `${progress}%` }} />
              </span>
              <span className="pct">{progress}%</span>
            </span>
          ) : null}
          {deadline ? (
            <span className="cosmic-planet-deadline">
              <Calendar className="size-2.5" /> {deadline}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
