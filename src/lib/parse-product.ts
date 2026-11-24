import { createServerFn } from "@tanstack/react-start";
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

function isBlockedIp(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ipv4 = mapped?.[1] ?? host;
  const parts = ipv4.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "metadata.google.internal") return true;
  return isBlockedIp(host);
}

function normalizeUrl(raw: string): URL | null {
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    if (/^[\w.-]+\.[a-z]{2,}([/?#]|$)/i.test(value)) value = `https://${value}`;
    else return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.port && url.port !== "80" && url.port !== "443") return null;
    if (isBlockedHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

const stamps: number[] = [];

function overLimit(): boolean {
  const now = Date.now();
  while (stamps.length && now - stamps[0]! > 60_000) stamps.shift();
  if (stamps.length >= 30) return true;
  stamps.push(now);
  return false;
}

async function assertPublicDns(hostname: string): Promise<boolean> {
  if (isBlockedHost(hostname)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) return !isBlockedIp(hostname);
  try {
    const { lookup } = await import("node:dns/promises");
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return false;
    return records.every((record) => !isBlockedIp(record.address));
  } catch {
    return false;
  }
}

async function readHtml(start: string): Promise<{ html: string; finalUrl: string } | null> {
  let current = start;
  for (let hop = 0; hop < 4; hop += 1) {
    const url = new URL(current);
    if (!(await assertPublicDns(url.hostname))) return null;
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      const next = new URL(location, current);
      if (next.protocol !== "http:" && next.protocol !== "https:") return null;
      if (isBlockedHost(next.hostname)) return null;
      current = next.toString();
      continue;
    }
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type && !type.includes("html") && !type.includes("xml") && !type.includes("text")) return null;
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      return { html: text.slice(0, 1_200_000), finalUrl: current };
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 1_200_000) {
      const step = await reader.read();
      if (step.done) break;
      if (!step.value) continue;
      chunks.push(step.value);
      size += step.value.byteLength;
    }
    await reader.cancel().catch(() => undefined);
    const html = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : concatBytes(chunks, size),
    );
    return { html: html.slice(0, 1_200_000), finalUrl: current };
  }
  return null;
}

function concatBytes(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(Math.min(size, 1_200_000));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= out.length) break;
  }
  return out;
}

export const parseProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const url =
      input && typeof input === "object" && "url" in input ? String((input as { url: unknown }).url ?? "") : "";
    return { url: url.trim().slice(0, 2000) };
  })
  .handler(async ({ data }): Promise<ParseResult> => {
    const url = normalizeUrl(data.url);
    if (!url) return fail("Это не похоже на ссылку");
    if (overLimit()) return fail("Слишком много запросов подряд — попробуйте через минуту");
    try {
      const page = await readHtml(url.toString());
      if (!page) return fail("Страница не открылась. Название и цену можно вписать самим");
      const draft = parseProductHtml(page.html, page.finalUrl);
      return { ...draft, error: null };
    } catch {
      return fail("Страница не открылась. Название и цену можно вписать самим");
    }
  });
