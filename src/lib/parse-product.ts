import { parseProductHtml, type ProductDraft } from "@/lib/product-html";

export interface ParseResult extends ProductDraft {
  error: string | null;
}

const EMPTY_RESULT: ParseResult = {
  title: null,
  price: null,
  currency: null,
  image: null,
  error: null,
};

function fail(error: string): ParseResult {
  return { ...EMPTY_RESULT, error };
}

function normalizeUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function parseProduct(input: { data: { url: string } }): Promise<ParseResult> {
  const url = normalizeUrl(input?.data?.url ?? "");
  if (!url) return fail("Это не похоже на ссылку");
  try {
    const res = await fetch(url.toString(), { mode: "cors" });
    if (!res.ok) return fail("Страница не открылась. Название и цену можно вписать самим");
    const html = await res.text();
    const draft = parseProductHtml(html, url.toString());
    return { ...draft, error: null };
  } catch {
    return fail("Магазин не отдаёт данные напрямую. Название и цену можно вписать самим");
  }
}
