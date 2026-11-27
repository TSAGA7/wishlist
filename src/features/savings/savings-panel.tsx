import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, parseAmount } from "@/lib/money";
import type { SavingOperation, Wish } from "@/types/wishlist";

export function SavingsPanel({
  wish,
  onChange,
  editable = true,
}: {
  wish: Wish;
  onChange: (wish: Wish) => void;
  editable?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");

  const target = wish.targetAmount;
  const progress = target && target > 0 ? Math.min(100, Math.round((wish.savedAmount / target) * 100)) : 0;
  const remaining = target != null ? Math.max(0, target - wish.savedAmount) : null;

  function addSaving() {
    const val = parseAmount(amount);
    if (!val || val <= 0) {
      toast.error("Введите сумму");
      return;
    }
    const op: SavingOperation = {
      id: crypto.randomUUID(),
      date: Date.now(),
      amount: val,
      comment: comment.trim() || undefined,
    };
    onChange({
      ...wish,
      savedAmount: wish.savedAmount + val,
      savingsHistory: [...wish.savingsHistory, op],
      updatedAt: Date.now(),
    });
    setAdding(false);
    setAmount("");
    setComment("");
    toast.success("Добавили накопление");
  }

  function removeOp(op: SavingOperation) {
    const nextHistory = wish.savingsHistory.filter((item) => item.id !== op.id);
    const nextSaved = Math.max(
      0,
      nextHistory.reduce((sum, item) => sum + item.amount, 0),
    );
    onChange({
      ...wish,
      savingsHistory: nextHistory,
      savedAmount: nextSaved,
      updatedAt: Date.now(),
    });
    toast.success("Операция удалена");
  }

  if (target == null && wish.savedAmount <= 0 && wish.savingsHistory.length === 0) {
    return null;
  }

  return (
    <div className="savings glass rounded-xl p-3">
      <div className="flex justify-between text-sm">
        <span>Накоплено {formatMoney(wish.savedAmount, wish.currency)}</span>
        <span>Осталось {remaining != null ? formatMoney(remaining, wish.currency) : "—"}</span>
      </div>
      {target != null ? (
        <div className="mt-2 flex items-center gap-2">
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
      ) : null}
      {progress >= 100 ? <p className="mt-1 text-center text-sm text-green-300">Цель достигнута</p> : null}

      {editable ? (
        !adding ? (
          <button type="button" className="mt-2 text-sm underline" onClick={() => setAdding(true)}>
            Добавить сумму
          </button>
        ) : (
          <div className="mt-2 space-y-2">
            <input
              className="field"
              placeholder="Сумма"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className="field"
              placeholder="Комментарий"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="button" className="save" onClick={addSaving}>
              Добавить
            </button>
            <button type="button" className="cancel" onClick={() => setAdding(false)}>
              Отмена
            </button>
          </div>
        )
      ) : null}

      {wish.savingsHistory.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {[...wish.savingsHistory].reverse().map((op) => (
            <li key={op.id} className="flex items-center gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium tabular-nums">{formatMoney(op.amount, wish.currency)}</div>
                <div className="text-muted">
                  {new Date(op.date).toLocaleDateString("ru-RU")}
                  {op.comment ? ` · ${op.comment}` : ""}
                </div>
              </div>
              {editable ? (
                <button type="button" className="icon-btn" aria-label="Удалить операцию" onClick={() => removeOp(op)}>
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
