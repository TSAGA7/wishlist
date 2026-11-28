import { Archive, Bookmark, Layers, Orbit, UserRound } from "lucide-react";
import type { DockTab } from "@/types/wishlist";

const ICONS = {
  home: Bookmark,
  map: Orbit,
  collections: Layers,
  archive: Archive,
  cabinet: UserRound,
} as const;

export function NavIcon({ id, className = "size-5" }: { id: DockTab; className?: string }) {
  const Icon = ICONS[id];
  return <Icon className={className} strokeWidth={1.75} />;
}
