import { Calendar, Flame, Plane, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { placeholderFor } from "@/services/paths";
import type { PlanetPose } from "@/features/cosmic/layout";
import type { Wish } from "@/types/wishlist";

function priorityLabel(wish: Wish): { text: string; hot: boolean } {
  if (wish.priority === "critical" || wish.priority === "high") return { text: "Высокий", hot: true };
  if (wish.priority === "medium") return { text: "Средний", hot: false };
  return { text: "Низкий", hot: false };
}

function shortDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const month = d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
  const label = month.charAt(0).toUpperCase() + month.slice(1);
  return `${label} ${d.getFullYear()}`;
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
  const goal = wish.targetAmount ?? wish.price;
  const progress = goal && goal > 0 ? Math.min(100, Math.round((wish.savedAmount / goal) * 100)) : 0;
  const pri = priorityLabel(wish);
  const deadline = shortDate(wish.deadline);
  const subtitle =
    wish.kind === "trip"
      ? [...wish.cities, ...wish.countries].filter(Boolean).slice(0, 3).join(" · ")
      : "";
  const photo = wish.image || placeholderFor(wish.kind);

  return (
    <button
      type="button"
      className={`cosmic-planet ${pose.hero ? "is-hero" : ""}`}
      style={{ left: pose.x, top: pose.y, width: pose.size, height: pose.size }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(wish);
      }}
    >
      {pose.hero ? <span className="cosmic-planet-ring" aria-hidden="true" /> : null}
      <span className="cosmic-planet-orb">
        <img src={photo} alt="" className="cosmic-planet-photo" draggable={false} />
        <span className="cosmic-planet-shade" aria-hidden="true" />
        <span className="cosmic-planet-content">
          <span className="cosmic-planet-kind" aria-hidden="true">
            {wish.kind === "trip" ? <Plane className="size-3.5" /> : <ShoppingBag className="size-3.5" />}
          </span>
          <span className={`cosmic-planet-priority ${pri.hot ? "hot" : ""}`}>
            {pri.hot ? <Flame className="size-3" /> : <span className="dot" />}
            {pri.text}
          </span>
          <strong className="cosmic-planet-title">{wish.title}</strong>
          {subtitle ? <span className="cosmic-planet-sub">{subtitle}</span> : null}
          {progress > 0 ? (
            <span className="cosmic-planet-progress">
              <span className="track">
                <span className="fill" style={{ width: `${progress}%` }} />
              </span>
              <span className="pct">{progress}%</span>
            </span>
          ) : null}
          {goal != null ? (
            <span className="cosmic-planet-money">
              {wish.targetAmount != null && wish.price != null && wish.targetAmount !== wish.price ? (
                <>
                  <b>{formatMoney(wish.price, wish.currency)}</b>
                  <span>из {formatMoney(wish.targetAmount, wish.currency)}</span>
                </>
              ) : (
                <b>{formatMoney(goal, wish.currency)}</b>
              )}
            </span>
          ) : null}
          {deadline ? (
            <span className="cosmic-planet-deadline">
              <Calendar className="size-3" /> {deadline}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
