# Wishlist

Отдельный проект. Не связан с MY WORLD.

Сайт: https://tsaga7.github.io/wishlist/

Код: https://github.com/TSAGA7/wishlist

## Как устроено

- Ветка `main` — исходники (React + TypeScript + Vite + Dexie).
- Ветка `gh-pages` — собранный сайт. Именно её отдаёт GitHub Pages по адресу `/wishlist/`.

Чтобы изменения появились на сайте:

1. `npm install`
2. `npm run build` (собирает с `base: "/wishlist/"` в папку `dist/`)
3. Содержимое `dist/` запушить в ветку `gh-pages`.

## Что умеет (v3)

- Покупки и поездки
- Приоритеты
- Накопления с историей и прогрессом
- Страница просмотра (редактирование отдельно)
- Тематические заглушки изображений
- Интерактивная космическая карта желаний (pan, pinch-zoom around midpoint, инерция, созвездия)
- Подборки (CRUD)
- Офлайн после первой загрузки (Service Worker)
- Резервная копия JSON

Данные хранятся только на устройстве (IndexedDB).

## Разработка

```bash
npm ci
npm run typecheck
npm run build
npm run dev
```

CI на `main` выполняет `typecheck` + `build`, затем публикует `dist/` в `gh-pages`.
