# ADR 0002: UI library — Primer (GitHub's design system)

**Status:** Accepted · **Date:** 2026-11-12 · **Supersedes:** [ADR 0001](./0001-ui-library.md)

## Decision

Use **Primer**: `@primer/react` (components), `@primer/primitives` (CSS-variable tokens) and
`@primer/octicons-react` (icons). React Spectrum S2, its style macro and our Bun plugin for it are gone.

## Why

We compared GitHub-style Primer prototypes with the S2 redesign, and Primer won. S2's buttons and fields
are pill-shaped and can't be made less rounded without overriding its CSS, which we don't do. Primer gives the
compact, plain look we want: the system font at 14 px, 28–32 px controls with 6 px corners, depth from borders
and grey header rows rather than shadows.

Primer also needs nothing special from Bun: its components ship plain CSS, so Bun's bundler, `bun test` and
Storybook (Vite) all work without a plugin.

## How to use it

- **Theme:** `App.tsx` wraps the app in `ThemeProvider colorMode="auto"` and `BaseStyles`. `index.html` sets
  `data-color-mode="auto" data-light-theme="light" data-dark-theme="dark"`. `main.tsx` imports the primitives
  plus the light and dark theme CSS.
- **Our own styles** are CSS modules beside each component (`Panel.module.css`), written only with Primer's
  tokens (`var(--borderColor-default)`, `var(--base-size-16)`, `var(--text-body-shorthand-small)`).
  Don't restyle Primer components' internals.
- **Fields** go through our wrappers in `src/web/components/`: TextField, NumberField, SelectField, DateField,
  CheckboxField, TextAreaField, SearchField and ComboBox. They share `field.ts`: server errors are keyed by name
  (`<Form errors>`), a required field has a hidden `*`, and Form blocks a submit while a required field is empty.
- **Gaps we fill ourselves:**
  - Primer has no public date picker or number field. We use `<input type="date">` and text inputs parsed by
    our money and quantity code.
  - Primer's autocomplete didn't fit, so ComboBox is our own ARIA combobox.
  - RecordTable wraps Primer's experimental `Table`.
  - Toasts are our own small store (`toast.ts`).
- **Links:** Primer links are plain `<a href>`. `useAppLinks` routes same-app clicks through react-router.

## Testing notes (happy-dom)

- happy-dom has no Popover API, so `test/setup.ts` stubs it. Primer's own polyfill loops forever there.
- Primer portals dialogs and menus into a root on `<body>`, which `cleanup()` doesn't remove. The test setup
  empties `<body>` after each test.
- Drop-downs are native `<select>`. Tests use `pick()` / `picker()` from `test/select.ts`.
