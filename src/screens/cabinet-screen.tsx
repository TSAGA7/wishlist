import { useState } from "react";
import {
  ChevronRight,
  Download,
  GripVertical,
  Monitor,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  Upload,
} from "lucide-react";
import { AppDock } from "@/components/shell/app-dock";
import { CURRENCIES, currencyLabel, type Currency } from "@/lib/money";
import type { DockTab, ThemeMode } from "@/types/wishlist";

export function CabinetScreen({
  theme,
  currency,
  dockOrder,
  onTheme,
  onCurrency,
  onDockOrder,
  onExport,
  onImport,
  onInstall,
  onCheckUpdate,
}: {
  theme: ThemeMode;
  currency: Currency;
  dockOrder: DockTab[];
  onTheme: (mode: ThemeMode) => void;
  onCurrency: (currency: Currency) => void;
  onDockOrder: (order: DockTab[]) => void;
  onExport: () => void;
  onImport: () => void;
  onInstall: () => void;
  onCheckUpdate: () => void;
}) {
  const [dockEdit, setDockEdit] = useState(false);

  return (
    <section className="cabinet">
      <div className="page-head mobile-only">
        <span className="icon-btn" aria-hidden="true" />
        <h1>Кабинет</h1>
        <span className="icon-btn" aria-hidden="true" />
      </div>
      <div className="desktop-toolbar">
        <h1>Кабинет</h1>
      </div>

      <div className="settings-list">
        <div className="row glass appearance">
          <span className="section-label">Внешний вид</span>
          <div className="segment wide">
            <button type="button" aria-pressed={theme === "light"} onClick={() => onTheme("light")}>
              <Sun className="size-4" /> Светлая
            </button>
            <button type="button" aria-pressed={theme === "dark"} onClick={() => onTheme("dark")}>
              <Moon className="size-4" /> Тёмная
            </button>
            <button type="button" aria-pressed={theme === "system"} onClick={() => onTheme("system")}>
              <Monitor className="size-4" /> Система
            </button>
          </div>
        </div>

        <div className="row glass appearance">
          <span className="section-label">Персонализация</span>
          <button
            type="button"
            className="row glass"
            style={{ margin: 0, padding: "0.65rem 0.75rem" }}
            aria-pressed={dockEdit}
            onClick={() => setDockEdit((open) => !open)}
          >
            <GripVertical className="size-5" />
            <span className="grow">
              <strong>Порядок вкладок</strong>
              <small>{dockEdit ? "Перетащите иконки, «Хотелки» всегда первые" : "Настроить нижнюю навигацию"}</small>
            </span>
            <ChevronRight className={`size-4 shrink-0 transition ${dockEdit ? "rotate-90" : ""}`} />
          </button>
          {dockEdit ? (
            <div className="dock-preview">
              <AppDock
                screen="cabinet"
                order={dockOrder}
                editing
                onNavigate={() => undefined}
                onReorder={onDockOrder}
              />
              <p className="dock-preview__hint">Удерживайте и перетащите вкладку. «Хотелки» закреплена слева.</p>
            </div>
          ) : null}
        </div>

        <label className="row glass">
          <span className="grow">
            <strong>Валюта</strong>
            <small>По умолчанию для новых желаний</small>
          </span>
          <select
            className="currency-select"
            value={currency}
            onChange={(event) => onCurrency(event.target.value as Currency)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabel(code)}
              </option>
            ))}
          </select>
        </label>

        <div className="row glass appearance">
          <span className="section-label">Данные</span>
          <button type="button" className="row glass" style={{ margin: 0 }} onClick={onExport}>
            <Download className="size-5" />
            <span className="grow">
              <strong>Скачать данные</strong>
              <small>Резервная копия на устройство</small>
            </span>
          </button>
          <button type="button" className="row glass" style={{ margin: 0 }} onClick={onImport}>
            <Upload className="size-5" />
            <span className="grow">
              <strong>Загрузить данные</strong>
              <small>Восстановить из копии</small>
            </span>
          </button>
        </div>

        <button type="button" className="row glass" onClick={onCheckUpdate}>
          <RefreshCw className="size-5" /> <span className="grow">Обновить приложение</span>
        </button>

        <button type="button" className="install-card glass" onClick={onInstall}>
          <span className="phone-badge">
            <Smartphone className="size-5" />
          </span>
          <span className="grow">
            <strong>Установи Wishlist как приложение</strong>
            <small>Работает офлайн, быстро и всегда под рукой.</small>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      </div>
    </section>
  );
}
