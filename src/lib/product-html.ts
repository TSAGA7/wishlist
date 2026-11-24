import { currencyFromCode, parseAmount, type Currency } from "@/lib/money";

export interface ProductDraft {
  title: string | null;
  price: number | null;
  currency: Currency | null;
  image: string | null;
}

const EMPTY: ProductDraft = { title: null, price: null, currency: null, image: null };

function decodeEntities(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&nbsp;/g, " ")
    .replace(/"/g, '"')
    .replace(/'|&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function metaContent(html: string, key: string): string | null {
  const attr = "(?:property|name|itemprop)";
  const patterns = [
    new RegExp(`<meta\\b[^>]*${attr}\\s*=\\s*["']${key}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*${attr}\\s*=\\s*["']${key}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return null;
}

function taggedContent(html: string, key: string): string | null {
  const fromMeta = metaContent(html, key);
  if (fromMeta) return fromMeta;
  const pattern = new RegExp(
    `<[^>]+\\b(?:itemprop|property)\\s*=\\s*["']${key}["'][^>]*\\b(?:content|value)\\s*=\\s*["']([^"']*)["']`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] ? decodeEntities(match[1]).trim() : null;
}

function cleanTitle(raw: string | null): string | null {
  if (!raw) return null;
  let title = decodeEntities(raw).replace(/\s+/g, " ").trim();
  if (!title) return null;
  for (const sep of [" | ", " — ", " – ", " · "]) {
    const at = title.lastIndexOf(sep);
    if (at > 8) {
      const right = title.slice(at + sep.length).trim();
      const left = title.slice(0, at).trim();
      if (right.length > 0 && right.length <= 40 && right.length < left.length) title = left;
    }
  }
  return title.slice(0, 180);
}

function safeImage(src: string | null, base: string): string | null {
  if (!src) return null;
  try {
    const url = new URL(src, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function typeIncludes(value: unknown, needle: string): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some((item) => typeof item === "string" && item.toLowerCase().includes(needle));
}

function imageFrom(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageFrom(item);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  if (typeof record.url === "string") return record.url;
  if (typeof record.contentUrl === "string") return record.contentUrl;
  return null;
}

function priceFromOffer(offer: Record<string, unknown>): { price: number | null; currency: Currency | null } {
  const spec = asRecord(offer.priceSpecification);
  const rawPrice =
    (typeof offer.price === "string" || typeof offer.price === "number" ? String(offer.price) : null) ??
    (typeof offer.lowPrice === "string" || typeof offer.lowPrice === "number" ? String(offer.lowPrice) : null) ??
    (spec && (typeof spec.price === "string" || typeof spec.price === "number") ? String(spec.price) : null);
  const rawCurrency =
    (typeof offer.priceCurrency === "string" ? offer.priceCurrency : null) ??
    (spec && typeof spec.priceCurrency === "string" ? spec.priceCurrency : null);
  return {
    price: rawPrice ? parseAmount(rawPrice) : null,
    currency: currencyFromCode(rawCurrency),
  };
}

function fromJsonLd(html: string): Partial<ProductDraft> {
  const found: Partial<ProductDraft> = {};
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const nodes: Record<string, unknown>[] = [];
  for (const match of html.matchAll(re)) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      collect(JSON.parse(body), nodes);
    } catch {
      /* ignore broken blocks */
    }
  }
  for (const node of nodes) {
    if (!typeIncludes(node["@type"], "product") && !node.offers) continue;
    if (!found.title && typeof node.name === "string") found.title = cleanTitle(node.name);
    if (!found.image) {
      const image = imageFrom(node.image);
      if (image) found.image = image;
    }
    const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
    for (const offer of offers) {
      const record = asRecord(offer);
      if (!record) continue;
      const priced = priceFromOffer(record);
      if (priced.price != null && found.price == null) found.price = priced.price;
      if (priced.currency && !found.currency) found.currency = priced.currency;
    }
    if (found.title && found.price != null && found.image) break;
  }
  return found;
}

function collect(value: unknown, out: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collect(item, out));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  out.push(record);
  if (record["@graph"]) collect(record["@graph"], out);
}

export function parseProductHtml(html: string, pageUrl: string): ProductDraft {
  const jsonLd = fromJsonLd(html);
  const title =
    cleanTitle(metaContent(html, "og:title")) ??
    cleanTitle(metaContent(html, "twitter:title")) ??
    jsonLd.title ??
    cleanTitle(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null);

  const amountRaw =
    taggedContent(html, "product:price:amount") ??
    taggedContent(html, "og:price:amount") ??
    taggedContent(html, "price") ??
    null;
  const price = (amountRaw ? parseAmount(amountRaw) : null) ?? jsonLd.price ?? null;
  const currency =
    currencyFromCode(
      metaContent(html, "product:price:currency") ??
        metaContent(html, "og:price:currency") ??
        metaContent(html, "priceCurrency") ??
        amountRaw,
    ) ??
    jsonLd.currency ??
    null;

  const image = safeImage(
    metaContent(html, "og:image") ??
      metaContent(html, "twitter:image") ??
      metaContent(html, "image") ??
      jsonLd.image ??
      null,
    pageUrl,
  );

  if (!title && price == null && !image) return EMPTY;
  return { title, price, currency, image };
}
