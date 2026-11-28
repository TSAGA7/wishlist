import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { OverlayFrame, useOverlayClose } from "@/components/overlay-frame";
import { formatMoney, parseAmount } from "@/lib/money";
import type { SavingOperation, Wish } from "@/types/wishlist";

export function SavingsPanel({
  wish,
  onChange,
}: {
  wish: Wish;
  onChange: (wish: Wish) => void;
}) {
  const [adding, setAdding] = useState(false);
  const goal = wish.price ?? wish.targetAmount;
  if (!wish.savingsEnabled || goal == null || goal <= 0) return null;

  const saved = Number.isFinite(wish.savedAmount) ? Math.max(0, wish.savedAmount) : 0;
  const progress = Math.min(100, Math.round((saved / goal) * 100));
  const remaining = Math.max(0, goal - saved);
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
    onChange({
      ...wish,
      savedAmount: saved + val,
      savingsHistory: [...wish.savingsHistory, op],
      updatedAt: Date.now(),
    });
    setAdding(false);
    toast.success("Сумма добавлена");
  }

  return (
    <>
      <div className="savings glass">
        <div className="flex justify-between gap-3 text-sm">
          <span>
            Накоплено
            <strong className="mt-0.5 block text-base">{formatMoney(saved, wish.currency)}</strong>
          </span>
          <span className="text-right">
            Осталось
            <strong className="mt-0.5 block text-base">{formatMoney(remaining, wish.currency)}</strong>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #f0a0c8, #f0b09a)",
              }}
            />
          </div>
          <span className="text-sm tabular-nums">{progress}%</span>
        </div>
        {deadline ? <p className="mt-2 text-sm text-muted">Срок: {deadline}</p> : null}
        {progress >= 100 ? <p className="savings-done">Полностью накоплено</p> : null}
        <button type="button" className="save mt-3" onClick={() => setAdding(true)}>
          Добавить сумму
        </button>
      </div>
      {adding ? (
        <AddAmountModal
          onClose={() => setAdding(false)}
          onAdd={addSaving}
        />
      ) : null}
    </>
  );
}

function AddAmountModal({ onClose, onAdd }: { onClose: () => void; onAdd: (value: string) => void }) {
  return (
    <OverlayFrame onClose={onClose} variant="center">
      <AddAmountCard onAdd={onAdd} />
    </OverlayFrame>
  );
}

function AddAmountCard({ onAdd }: { onAdd: (value: string) => void }) {
  const dismiss = useOverlayClose();
  const [amount, setAmount] = useState("");
  return (
    <div className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-amount-title">
      <div className="add-modal__head">
        <h2 id="add-amount-title">Добавить сумму</h2>
        <button type="button" className="add-modal__close" aria-label="Закрыть" onClick={() => dismiss?.()}>
          <X className="size-5" />
        </button>
      </div>
      <input
        className="field"
        placeholder="Сумма"
        inputMode="decimal"
        autoFocus
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button type="button" className="save mt-3" onClick={() => onAdd(amount)}>
        Добавить
      </button>
      <button type="button" className="cancel" onClick={() => dismiss?.()}>
        Отмена
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
