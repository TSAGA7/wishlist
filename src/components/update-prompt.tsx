import { RefreshCw } from "lucide-react";
import { applyUpdate, dismissUpdate, useUpdate } from "@/lib/app-update";

/** «Вышло обновление» — the same step as My World: the new version waits until «Обновить». */
export function UpdatePrompt() {
  const update = useUpdate();
  if (update.kind !== "ready") return null;
  return (
    <div className="update-overlay" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <div className="update-card">
        <span className="update-badge" aria-hidden="true">
          <RefreshCw className="size-5" />
        </span>
        <h2 id="update-title">Вышло обновление</h2>
        <p>Исправления и улучшения. Желания останутся на этом устройстве.</p>
        <button type="button" className="save" onClick={applyUpdate}>
          Обновить
        </button>
        <button type="button" className="cancel" onClick={dismissUpdate}>
          Позже
        </button>
      </div>
    </div>
  );
}
