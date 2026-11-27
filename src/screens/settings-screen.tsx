import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Info, Moon, Settings, Smartphone, Sun, Upload } from "lucide-react";
import { CURRENCIES, currencyLabel, type Currency } from "@/lib/money";

export function SettingsScreen({
  dark,
  currency,
  onTheme,
  onCurrency,
  onExport,
  onImport,
  onInstall,
  onBack,
  onMap,
}: {
  dark: boolean;
  currency: Currency;
  onTheme: (mode: "light" | "dark") => void;
  onCurrency: (currency: Currency) => void;
  onExport: () => void;
  onImport: () => void;
  onInstall: () => void;
  onBack: () => void;
  onMap: () => void;
}) {
  const [about, setAbout] = useState(false);
  return (
    <section>
      <div className="page-head mobile-only">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </button>
        <h1>Настройки</h1>
        <span className="icon-btn" aria-hidden="true">
          <Settings className="size-5" />
        </span>
      </div>
      <div className="desktop-toolbar">
        <h1>Настройки</h1>
      </div>
      <div className="settings-list">
        <div className="row glass appearance">
          <span className="section-label">Внешний вид</span>
          <div className="segment wide">
            <button type="button" aria-pressed={!dark} onClick={() => onTheme("light")}>
              <Sun className="size-4" /> Светлая
            </button>
            <button type="button" aria-pressed={dark} onClick={() => onTheme("dark")}>
              <Moon className="size-4" /> Тёмная
            </button>
          </div>
        </div>
        <label className="row glass">
          <span className="grow">Валюта по умолчанию</span>
          <select
            className="currency-select"
            value={currency}
            onChange={(event) => onCurrency(event.target.value as Currency)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabel(code)} ({code})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="row glass" onClick={onExport}>
          <Download className="size-5" /> <span className="grow">Экспорт данных (JSON)</span>
        </button>
        <button type="button" className="row glass" onClick={onImport}>
          <Upload className="size-5" /> <span className="grow">Импорт данных (JSON)</span>
        </button>
        <button type="button" className="row glass" aria-expanded={about} onClick={() => setAbout((open) => !open)}>
          <Info className="size-5" />
          <span className="grow">
            <strong>О приложении</strong>
          </span>
          <ChevronRight className={`size-4 shrink-0 transition ${about ? "rotate-90" : ""}`} />
        </button>
        {about ? (
          <p className="about-copy">
            Список живёт только на этом устройстве. Ссылка подтягивает название, цену и фото, когда страница это
            отдаёт. Копия JSON возвращает список, если очистите браузер.
          </p>
        ) : null}
        <button type="button" className="row glass" onClick={onMap}>
          <span className="grow">Карта желаний</span>
          <ChevronRight className="size-4 shrink-0" />
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
