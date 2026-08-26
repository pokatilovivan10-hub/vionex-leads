# Hero, Cases and Auto Experience Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Обновить главный оффер, математику демонстрационных кейсов и подтверждение опыта без изменения дизайна страницы.

**Architecture:** Это статический сайт. Изменения ограничены контентом `index.html`; регрессионная проверка реализуется встроенным `node:test` без новых зависимостей.

**Tech Stack:** HTML5, JavaScript, Node.js `node:test`.

---

### Task 1: Контентный контракт

**Files:**
- Create: `tests/content.test.mjs`
- Modify: `index.html`

**Step 1: Write the failing test**

Добавить тест, который проверяет точный H1, три воронки, три CPL, синхронизацию подробного модального кейса и фразу про пять лет опыта. В тесте вычислить итоговые конверсии 20% и 10%, средний CPL 1 500 ₽.

**Step 2: Run test — confirm it fails**

Command: `node --test tests/content.test.mjs`

Expected: FAIL — текущий H1 и старые значения кейсов не соответствуют контракту.

**Step 3: Write minimal implementation**

Обновить только целевые строки `index.html`. Стили, DOM-структуру и JavaScript не менять.

**Step 4: Run test — confirm it passes**

Command: `node --test tests/content.test.mjs`

Expected: PASS.

**Step 5: Verify rendering**

Запустить локальный HTTP-сервер, открыть страницу в браузере на 375, 768, 1280 и 1440 px. Проверить отсутствие горизонтального переполнения, JS-ошибок и наличие нового контента.

**Step 6: Commit**

`git add index.html tests/content.test.mjs docs/plans && git commit -m "Update VIONEX offer and case metrics"`

