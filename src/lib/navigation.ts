import {
  DEFAULT_DOCK_ORDER,
  type AppSettings,
  type DockTab,
  type ThemeMode,
} from "@/types/wishlist";

export const NAV_ITEMS: { id: DockTab; label: string }[] = [
  { id: "home", label: "Хотелки" },
  { id: "map", label: "Карта" },
  { id: "collections", label: "Подборки" },
  { id: "archive", label: "Архив" },
  { id: "cabinet", label: "Кабинет" },
];

export function isDockTab(value: unknown): value is DockTab {
  return typeof value === "string" && NAV_ITEMS.some((item) => item.id === value);
}

export function tabLabel(id: DockTab): string {
  return NAV_ITEMS.find((item) => item.id === id)?.label ?? id;
}

export function normalizeSettings(input?: Partial<AppSettings> | null): AppSettings {
  const theme: ThemeMode =
    input?.theme === "light" || input?.theme === "dark" || input?.theme === "system" ? input.theme : "system";
  const dockOrder: DockTab[] = [];
  for (const item of input?.dockOrder ?? []) {
    if (isDockTab(item) && !dockOrder.includes(item)) dockOrder.push(item);
  }
  for (const item of DEFAULT_DOCK_ORDER) {
    if (!dockOrder.includes(item)) dockOrder.push(item);
  }
  const homeScreen: DockTab = isDockTab(input?.homeScreen) ? input.homeScreen : "home";
  const dockHidden: DockTab[] = [];
  for (const item of input?.dockHidden ?? []) {
    if (isDockTab(item) && item !== homeScreen && !dockHidden.includes(item)) dockHidden.push(item);
  }
  const visible = dockOrder.filter((tab) => !dockHidden.includes(tab));
  if (!visible.length) {
    const keep = dockOrder[0] ?? homeScreen;
    return {
      theme,
      dockOrder,
      homeScreen,
      dockHidden: dockHidden.filter((tab) => tab !== keep),
    };
  }
  return { theme, dockOrder, homeScreen, dockHidden };
}

export function visibleDock(settings: AppSettings): DockTab[] {
  const hidden = new Set(settings.dockHidden);
  const visible = settings.dockOrder.filter((tab) => !hidden.has(tab));
  if (visible.length) return visible;
  return [settings.homeScreen];
}

export function withHomeScreen(settings: AppSettings, homeScreen: DockTab): { settings: AppSettings; revealed: boolean } {
  const revealed = settings.dockHidden.includes(homeScreen);
  return {
    revealed,
    settings: normalizeSettings({
      ...settings,
      homeScreen,
      dockHidden: settings.dockHidden.filter((tab) => tab !== homeScreen),
    }),
  };
}

export function withDockOrder(settings: AppSettings, dockOrder: DockTab[]): AppSettings {
  return normalizeSettings({ ...settings, dockOrder });
}

export function withTabVisibility(
  settings: AppSettings,
  tab: DockTab,
  visible: boolean,
): { settings: AppSettings; blocked?: "home" | "last" } {
  if (visible) {
    return {
      settings: normalizeSettings({
        ...settings,
        dockHidden: settings.dockHidden.filter((item) => item !== tab),
      }),
    };
  }
  if (tab === settings.homeScreen) return { settings, blocked: "home" };
  const remaining = settings.dockOrder.filter((item) => item !== tab && !settings.dockHidden.includes(item));
  if (!remaining.length) return { settings, blocked: "last" };
  return {
    settings: normalizeSettings({
      ...settings,
      dockHidden: settings.dockHidden.includes(tab) ? settings.dockHidden : [...settings.dockHidden, tab],
    }),
  };
}
