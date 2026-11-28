export const STANDALONE_STORAGE_NOTICE =
  "Wishlist хранит данные на этом устройстве. Safari и приложение, установленное на экран «Домой», используют разные локальные хранилища. Если вы раньше добавляли желания в Safari, экспортируйте их там и загрузите резервную копию в приложение.";

export function isStandaloneApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
