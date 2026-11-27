import type { Currency } from "@/lib/money";

export type WishKind = "purchase" | "trip";
export type Priority = "low" | "medium" | "high" | "critical";
export type Screen = "home" | "map" | "archive" | "backups" | "settings" | "collections";
export type HomeFilter = "all" | "purchases" | "trips";

export interface SavingOperation {
  id: string;
  date: number;
  amount: number;
  comment?: string;
}

export interface Wish {
  id: string;
  kind: WishKind;
  title: string;
  price: number | null;
  currency: Currency;
  note: string;
  url: string;
  image: string | null;
  priceAuto: boolean;
  archived: boolean;
  order: number;
  collectionId: string | null;
  priority: Priority;
  targetAmount: number | null;
  savedAmount: number;
  deadline: string | null;
  savingsHistory: SavingOperation[];
  countries: string[];
  cities: string[];
  startDate: string | null;
  endDate: string | null;
  mapX?: number | null;
  mapY?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  coverImage: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface WishDraft {
  id: string | null;
  kind: WishKind;
  url: string;
  title: string;
  price: string;
  currency: Currency;
  note: string;
  image: string | null;
  archived: boolean;
  priceAuto: boolean;
  priority: Priority;
  collectionId: string | null;
  targetAmount: string;
  savedAmount: string;
  deadline: string;
  countries: string;
  cities: string;
  startDate: string;
  endDate: string;
}

export interface CollectionDraft {
  id: string | null;
  title: string;
  description: string;
  icon: string;
  color: string;
  coverImage: string | null;
}

export const COLLECTION_COLORS = [
  "#7c6af7",
  "#f0b09a",
  "#6d82b4",
  "#5ecf9a",
  "#f5c542",
  "#ff7a9a",
  "#4ecdc4",
  "#c9a0b4",
] as const;

export const COLLECTION_ICONS = ["folder", "sparkles", "plane", "shirt", "home", "dumbbell", "gift", "heart"] as const;
