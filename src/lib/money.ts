export type Currency = "RUB" | "USD" | "EUR";

export const CURRENCIES: Currency[] = ["RUB", "USD", "EUR"];

export function currencyLabel(currency: Currency): string {
  if (currency === "RUB") return "₽";
  if (currency === "USD") return "$";
  return "€";
}

export function goodsWord(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "товаров";
  if (last === 1) return "товар";
  if (last >= 2 && last <= 4) return "товара";
  return "товаров";
}

export function wishesWord(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "хотелок";
  if (last === 1) return "хотелка";
  if (last >= 2 && last <= 4) return "хотелки";
  return "хотелок";
}

export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s|\u00a0/g, "");
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, "");
  if (!s || s === "-" || s === "," || s === ".") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      s = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      s = s.replace(/,/g, "");
    }
  }
  const value = Number(s);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) return null;
  return Math.round(value * 100) / 100;
}

export function formatMoney(amount: number, currency: Currency): string {
  if (!Number.isFinite(amount)) return "—";
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function currencyFromCode(raw: string | null | undefined): Currency | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (code === "RUB" || code === "RUR" || code === "₽") return "RUB";
  if (code === "USD" || code === "$" || code === "US$") return "USD";
  if (code === "EUR" || code === "€") return "EUR";
  if (raw.includes("₽") || /руб/i.test(raw)) return "RUB";
  if (raw.includes("€")) return "EUR";
  if (raw.includes("$")) return "USD";
  return null;
}
