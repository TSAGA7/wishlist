import { useState } from "react";
import { Calendar, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import { formatMoney, parseAmount, type Currency } from "@/lib/money";
import type { SavingOperation, Wish } from "@/types/wishlist";

export function savingsFigures(wish: Pick<Wish, "price" | "targetAmount" | "savedAmount">) {
  const goalRaw = wish.price ?? wish.targetAmount;
  const hasGoal = typeof goalRaw === "number" && Number.isFinite(goalRaw) && goalRaw > 0;
  const goal = hasGoal ? goalRaw : null;
  const saved = Number.isFinite(wish.savedAmount) ? Math.max(0, wish.savedAmount) : 0;
  const remaining = goal == null ? null : Math.max(0, goal - saved);
  const progress = goal == null ? 0 : Math.min(100, Math.round((saved / goal) * 100));
  const achieved = goal != null && saved >= goal;
  return { goal, saved, remaining, progress, achieved };
}

export function SavingsPanel({
  wish,
  onChange,
}: {
  wish: Wish;
  onChange: (wish: Wish) => void;
}) {
  const [adding, setAdding] = useState(false);
  if (!wish.savingsEnabled) return null;

  const { goal, saved, remaining, progress, achieved } = savingsFigures(wish);
  const deadline = formatDeadline(wish.deadline);

  function addSaving(raw: string) {
    const val = parseAmount(raw);
    if (!val || val <= 0) {
      toast.error("Введите сумму");
      return;
    }
    const op: SavingOperation = {
      id: crypto.randomUUID(),
      date: Date.now(),
      amount: val,
    };
    const nextSaved = saved + val;
    onChange({
      ...wish,
      savedAmount: nextSaved,
      savingsHistory: [...(wish.savingsHistory ?? []), op],
      updatedAt: Date.now(),
    });
    setAdding(false);
    toast.success("Сумма добавлена");
  }

  return (
    <>
      <section className="savings" aria-label="Накопления">
        <div className="savings-metrics">
          <p className="savings-metric">
            <small>Накоплено</small>
            <strong>{formatMoney(saved, wish.currency)}</strong>
          </p>
          <p className="savings-metric is-end">
            <small>Осталось</small>
            <strong>{remaining == null ? "—" : formatMoney(remaining, wish.currency)}</strong>
          </p>
        </div>
        <div className="savings-progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} role="meter">
          <span className="savings-progress__track">
            <span className="savings-progress__fill" style={{ width: `${progress}%` }} />
          </span>
          <span className="savings-progress__pct">{progress}%</span>
        </div>
        {deadline ? (
          <p className="savings-deadline">
            <Calendar className="size-4" aria-hidden="true" />
            <span>
              Срок <strong>{deadline}</strong>
            </span>
          </p>
        ) : null}
        {achieved ? <p className="savings-done">Цель достигнута</p> : null}
        {goal == null ? <p className="savings-hint">Укажите стоимость — она станет целью накопления</p> : null}
        <button type="button" className="savings-add" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Добавить сумму
        </button>
      </section>
      {adding ? (
        <AddAmountModal
          saved={saved}
          currency={wish.currency}
          onClose={() => setAdding(false)}
          onAdd={addSaving}
        />
      ) : null}
    </>
  );
}

function AddAmountModal({
  saved,
  currency,
  onClose,
  onAdd,
}: {
  saved: number;
  currency: Currency;
  onClose: () => void;
  onAdd: (value: string) => void;
}) {
  return (
    <OverlayFrame onClose={onClose} variant="center">
      <AddAmountCard saved={saved} currency={currency} onAdd={onAdd} />
    </OverlayFrame>
  );
}

function AddAmountCard({
  saved,
  currency,
  onAdd,
}: {
  saved: number;
  currency: Currency;
  onAdd: (value: string) => void;
}) {
  const dismiss = useOverlayClose();
  const [amount, setAmount] = useState("");
  return (
    <div className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-amount-title">
      <div className="add-modal__head">
        <h2 id="add-amount-title">Пополнить накопления</h2>
        <button type="button" className="add-modal__close" aria-label="Закрыть" onClick={() => dismiss?.()}>
          <X className="size-5" />
        </button>
      </div>
      <p className="add-modal__now">
        Сейчас накоплено <strong>{formatMoney(saved, currency)}</strong>
      </p>
      <input
        className="field"
        placeholder="Сумма"
        inputMode="decimal"
        autoFocus
        value={amount}
        aria-label="Сумма пополнения"
        onChange={(event) => setAmount(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onAdd(amount);
        }}
      />
      <button type="button" className="save mt-3" onClick={() => onAdd(amount)}>
        Добавить
      </button>
    </div>
  );
}

function formatDeadline(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
