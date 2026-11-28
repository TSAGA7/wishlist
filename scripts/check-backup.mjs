import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});

const backup = await server.ssrLoadModule("/src/lib/backup.ts");
const db = await server.ssrLoadModule("/src/database/wishlist-db.ts");

const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const wish = {
  id: "wish-1",
  kind: "purchase",
  title: "Лампа",
  price: 10,
  currency: "RUB",
  note: "",
  url: "",
  image: "idb:photo-1",
  priceAuto: false,
  archived: false,
  completed: false,
  order: 0,
  collectionId: null,
  priority: "medium",
  savingsEnabled: false,
  targetAmount: null,
  savedAmount: 0,
  deadline: null,
  savingsHistory: [],
  countries: [],
  cities: [],
  startDate: null,
  endDate: null,
  location: "",
  eventDate: null,
  mapX: null,
  mapY: null,
  createdAt: 1,
  updatedAt: 1,
};

const file = backup.buildBackup("Мои хотелки", [wish], [], {
  currency: "RUB",
  photos: [{ id: "photo-1", mime: "image/png", dataUrl: pixel }],
});
if (file.version !== 4 || file.photos.length !== 1) {
  throw new Error("backup v4 did not include the photo");
}

const parsed = backup.parseBackup(file);
if (!parsed || parsed.photos.length !== 1 || parsed.photoProblems.length !== 0) {
  throw new Error(`round-trip failed: ${JSON.stringify(parsed?.photoProblems)}`);
}
if (parsed.photos[0].id !== "photo-1" || parsed.photos[0].blob.size < 1) {
  throw new Error("photo blob was not restored");
}
if (parsed.wishes[0].image !== "idb:photo-1") {
  throw new Error("wish image id was rewritten");
}

const legacy = backup.parseBackup({
  version: 3,
  profile: { name: "Старый", currency: "USD" },
  wishes: [{ ...wish, image: "https://example.com/a.jpg" }],
  collections: [{ id: "c1", title: "Дом", description: "", icon: "folder", color: "#fff", coverImage: null, order: 0, createdAt: 1, updatedAt: 1 }],
});
if (!legacy || legacy.wishes.length !== 1 || legacy.collections.length !== 1 || legacy.photos.length !== 0) {
  throw new Error("v3 backup was not accepted");
}
if (legacy.currency !== "USD" || legacy.name !== "Старый") {
  throw new Error("v3 profile was dropped");
}

const broken = backup.parseBackup({
  wishes: [{ ...wish, title: "Без фото" }],
  photos: [{ id: "bad", dataUrl: "data:image/png;base64,@@@@" }],
});
if (!broken || broken.photos.length !== 0 || !broken.photoProblems.length) {
  throw new Error("unreadable photo was treated as a successful backup");
}

const dangling = backup.parseBackup({
  version: 2,
  wishes: [wish],
});
if (!dangling || !dangling.photoProblems.some((item) => item.includes("нет"))) {
  throw new Error("missing photo blob was not reported");
}

const huge = `data:image/png;base64,${"A".repeat(backup.MAX_BACKUP_DATA_URL_CHARS)}`;
const oversized = backup.parseBackup({
  wishes: [{ ...wish, image: null }],
  photos: [{ id: "big", mime: "image/png", dataUrl: huge }],
});
if (!oversized || oversized.photos.length !== 0 || !oversized.photoProblems.some((item) => item.includes("большое"))) {
  throw new Error("oversized photo was accepted");
}

if (typeof db.requestPersistentStorage !== "function" || typeof db.diagnoseStorage !== "function") {
  throw new Error("storage diagnostics were not exported");
}
if (db.formatStorageError({ name: "QuotaExceededError", message: "full" }) !== "UnknownError: не удалось прочитать локальную базу") {
  const formatted = db.formatStorageError(Object.assign(new Error("full"), { name: "QuotaExceededError" }));
  if (!formatted.startsWith("QuotaExceededError:")) throw new Error(formatted);
}

await server.close();
console.log("backup checks passed");
