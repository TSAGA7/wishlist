import { ChevronLeft, Download, Upload } from "lucide-react";
import { wishesWord } from "@/lib/money";

export function BackupsScreen({
  count,
  onBack,
  onExport,
  onImport,
}: {
  count: number;
  onBack: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <section>
      <div className="page-head mobile-only">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Резервные копии</h1>
        <span className="w-11" />
      </div>
      <div className="desktop-toolbar">
        <h1>Резервные копии</h1>
      </div>
      <p className="mt-2 text-muted">
        В списке {count} {wishesWord(count)}. Файл JSON можно сохранить и вернуть на это устройство.
      </p>
      <div className="backup-list">
        <button type="button" className="row glass" onClick={onExport}>
          <Download className="size-5" /> Экспорт JSON
        </button>
        <button type="button" className="row glass" onClick={onImport}>
          <Upload className="size-5" /> Импорт JSON
        </button>
      </div>
    </section>
  );
}
