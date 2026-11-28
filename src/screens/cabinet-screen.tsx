import { useState } from "react";
import { Bookmark, ChevronRight, Download, Monitor, Moon, RefreshCw, Rows3, Shield, Smartphone, Sun, Upload } from "lucide-react";
import { toast } from "sonner";
import { HomeScreenSettings, TabOrderSettings } from "@/components/shell/nav-settings";
import type { PersistentStorageStatus } from "@/database/wishlist-db";
import { CURRENCIES, currencyLabel, type Currency } from "@/lib/money";
import { STANDALONE_STORAGE_NOTICE } from "@/lib/standalone";
import { tabLabel, withDockOrder, withHomeScreen, withTabVisibility } from "@/lib/navigation";
import type { AppSettings, DockTab, ThemeMode } from "@/types/wishlist";

function formatExportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

function persistenceLabel(info: PersistentStorageStatus | null): string {
  if (!info) return "Проверяем защиту хранилища…";
  if (!info.supported) return "Этот браузер не сообщает, защищено ли хранилище от вытеснения.";
  if (info.persisted) return "Включена. Браузер реже удаляет данные из-за нехватки места.";
  return "Не подтверждена. При нехватке места браузер может сам очистить данные.";
}

export function CabinetScreen({
  theme,
  currency,
  settings,
  onTheme,
  onCurrency,
  onSettings,
  onExport,
  onImport,
  onInstall,
  onCheckUpdate,
  exporting,
  lastExportAt,
  persistence,
}: {
  theme: ThemeMode;
  currency: Currency;
  settings: AppSettings;
  onTheme: (mode: ThemeMode) => void;
  onCurrency: (currency: Currency) => void;
  onSettings: (patch: Partial<AppSettings>) => void;
  onExport: () => void;
  onImport: () => void;
  onInstall: () => void;
  onCheckUpdate: () => void;
  exporting: boolean;
  lastExportAt: string | null;
  persistence: PersistentStorageStatus | null;
}) {
  const [panel, setPanel] = useState<"home" | "order" | null>(null);

  function chooseHome(home: DockTab) {
    const result = withHomeScreen(settings, home);
    onSettings({ homeScreen: result.settings.homeScreen, dockHidden: result.settings.dockHidden });
    if (result.revealed) toast(`«${tabLabel(home)}» снова в панели и откроется при запуске`);
  }

  function changeOrder(order: DockTab[]) {
    const next = withDockOrder(settings, order);
    onSettings({ dockOrder: next.dockOrder });
  }

  function changeVisibility(tab: DockTab, visible: boolean) {
    const result = withTabVisibility(settings, tab, visible);
    if (result.blocked === "home") {
      toast("Это главный экран. Сначала назначьте другой раздел");
      return;
    }
    if (result.blocked === "last") {
      toast("Нужна хотя бы одна вкладка в панели");
      return;
    }
    onSettings({ dockHidden: result.settings.dockHidden });
    if (!visible && tab === "cabinet") {
      toast("Кабинет скрыт. Удерживайте нижнюю панель, чтобы открыть настройки");
    }
  }

  if (panel === "home") {
    return <HomeScreenSettings settings={settings} onChange={chooseHome} onClose={() => setPanel(null)} />;
  }

  if (panel === "order") {
    return (
      <TabOrderSettings
        settings={settings}
        onOrder={changeOrder}
        onVisibility={changeVisibility}
        onClose={() => setPanel(null)}
      />
    );
  }

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
          <span className="section-label">Навигация</span>
          <button type="button" className="row glass nav-entry" onClick={() => setPanel("home")}>
            <Bookmark className="size-5" />
            <span className="grow">
              <strong>Главный экран</strong>
              <small>Сейчас: {tabLabel(settings.homeScreen)}</small>
            </span>
            <ChevronRight className="size-4 shrink-0" />
          </button>
          <button type="button" className="row glass nav-entry" onClick={() => setPanel("order")}>
            <Rows3 className="size-5" />
            <span className="grow">
              <strong>Порядок вкладок</strong>
              <small>Состав и порядок нижней панели</small>
            </span>
            <ChevronRight className="size-4 shrink-0" />
          </button>
        </div>

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
          <button type="button" className="row glass nav-entry" onClick={onExport} disabled={exporting}>
            <Download className="size-5" />
            <span className="grow">
              <strong>{exporting ? "Подготавливаем резервную копию..." : "Скачать резервную копию"}</strong>
              <small>
                {exporting
                  ? "Собираем желания и локальные фото"
                  : lastExportAt
                    ? `Последняя копия: ${formatExportDate(lastExportAt)}`
                    : "Желания, подборки и локальные фото"}
              </small>
            </span>
          </button>
          <button type="button" className="row glass nav-entry" onClick={onImport} disabled={exporting}>
            <Upload className="size-5" />
            <span className="grow">
              <strong>Загрузить резервную копию</strong>
              <small>Восстановить список и фото из файла</small>
            </span>
          </button>
        </div>

        <div className="row glass appearance">
          <span className="section-label">
            <Shield className="mr-1 inline size-4" /> Защита данных на устройстве
          </span>
          <p className="storage-note">{STANDALONE_STORAGE_NOTICE}</p>
          <p className="storage-note">
            Удаление приложения с экрана «Домой» или очистка данных сайта стирает локальную базу. Повторная установка
            сама по себе ничего не вернёт: нужна резервная копия или серверная синхронизация. Защита от вытеснения не
            спасает от удаления вручную.
          </p>
          <p className="storage-note">Защита от вытеснения: {persistenceLabel(persistence)}</p>
          {persistence?.usage != null && persistence.quota != null ? (
            <p className="storage-note">
              Занято {formatBytes(persistence.usage)} из {formatBytes(persistence.quota)}.
            </p>
          ) : null}
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
