# i18n-and-ui Specification

## Purpose

Internationalise Spindrift Chess with EN/LT locale support and replace emoji-based
game-end icons with properly styled Phosphor (vd3) icons. Includes a locale
switcher in the navbar and a full Lithuanian translation of all UI text.

Brand protection: "Spindrift" is never translated or altered.

## Requirements

### Requirement: Lightweight i18n infrastructure

The app SHALL provide internationalisation via a custom `useI18n()` composable
without adding external i18n dependencies. Translation maps SHALL live in
`src/locales/{en,lt}.ts` and the active locale SHALL persist to `localStorage`
under the `sdc-locale` key.

#### Scenario: Default locale is English

- **WHEN** a new user visits the app with no `sdc-locale` key in localStorage
- **THEN** the UI renders in English

#### Scenario: Locale persists across page reloads

- **WHEN** the user switches to Lithuanian and refreshes the page
- **THEN** the UI renders in Lithuanian

#### Scenario: All visible text is translatable

- **WHEN** the active locale is Lithuanian
- **THEN** every user-facing Spindrift string (labels, buttons, modals, aria-labels,
  status text, piece descriptions) is displayed in Lithuanian

### Requirement: Theme mode only (no customizer)

The app SHALL NOT expose a theme customizer (no primary / neutral / radius / font
/ palette UI). The header SHALL provide `VdThemeSwitcher` (`#theme-toggle-btn`)
for light / dark / system only.

On every load, palette, neutral, radius, font, and primary SHALL be forced to
Spindrift product defaults, overwriting any prior `sdc-*` theme localStorage
values for those fields:

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Palette | `open-color`                               |
| Neutral | `stone`                                    |
| Radius  | `0.375`                                    |
| Font    | `ubuntu`                                   |
| Primary | `black` (light/`system`) or `amber` (dark) |

Light/dark/`system` theme mode SHALL remain user-persisted under
`sdc-theme-preference`. All theme preference keys SHALL use the `sdc-` prefix
(via vd3 `storagePrefix`); leftover `vanduo-*` keys SHALL be migrated then purged.

Non-goals: Fibonacci palette, theme panel or swatches fan, per-user primary /
neutral / radius / font controls.

#### Scenario: No theme customizer control

- **WHEN** the app loads on desktop or mobile
- **THEN** there is no `[data-theme-customizer-trigger]` in the document
- **AND** `#theme-toggle-btn` is visible in the header

#### Scenario: Locked chrome and primary override prior localStorage

- **WHEN** a returning user has non-default `sdc-neutral-color`,
  `sdc-radius`, `sdc-font-preference`, `sdc-palette`, or
  `sdc-primary-color`
- **AND** the app loads
- **THEN** those keys and matching `data-*` attributes are forced to the locked
  defaults (including scheme primary)
- **AND** `sdc-theme-preference` is preserved

#### Scenario: Theme mode remains independent

- **WHEN** the user cycles light / dark / system via `VdThemeSwitcher`
- **THEN** `sdc-theme-preference` updates accordingly
- **AND** locked chrome fields stay at product defaults
- **AND** primary follows the scheme default for the new mode

### Requirement: Brand protection

The word "Spindrift" SHALL be immutable across all locales. It SHALL NOT be
translated, transliterated, or altered in any way.

#### Scenario: App title in Lithuanian

- **WHEN** the active locale is Lithuanian
- **THEN** the app title in the header reads "Spindrift Šachmatai" (not "Šachmatai")

#### Scenario: Lithuanian title readable on narrow phones

- **WHEN** the active locale is Lithuanian and the viewport is about 360–393px wide
- **THEN** the full header title "Spindrift Šachmatai" is visible without ellipsis truncation
- **AND** header control gaps/paddings MAY tighten to keep the title on one line
- **AND** on very narrow viewports (~320px and below) the product word "Šachmatai" MAY
  stack under the immutable brand "Spindrift" with a small vertical gap between the lines

#### Scenario: Brand references in modal text

- **WHEN** modal text references the app name in Lithuanian
- **THEN** the text uses "Spindrift Šachmatai" while keeping the word
  "Spindrift" untranslated

### Requirement: Locale switcher in navbar

The app header SHALL display a vd3 Mode Toggle morph control that toggles
between English and Lithuanian. The control SHALL show the active locale with
an inline SVG flag and an EN or LT label. The locale SHALL persist under
`sdc-locale`.

#### Scenario: Desktop layout

- **WHEN** the viewport is >= 769px
- **THEN** the locale morph toggle appears in the header bar near the theme
  mode toggle

#### Scenario: Mobile layout

- **WHEN** the viewport is < 769px
- **THEN** the locale morph toggle remains visible in the header bar near the
  theme mode toggle (not only inside the offcanvas menu)

#### Scenario: Switching locale

- **WHEN** the user activates the locale morph toggle while English is active
- **THEN** all UI text updates to Lithuanian immediately
- **AND** the toggle morphs to show the Lithuanian flag and LT label
- **AND** the locale is persisted to localStorage under `sdc-locale`

### Requirement: Phosphor game-end icons

The `GameEndModal` SHALL use Phosphor font icons instead of Unicode emojis for
the result indicator. Icons SHALL be colour-toned to match the result.

| Outcome  | Phosphor Icon   | Colour Tone     |
| -------- | --------------- | --------------- |
| Victory  | `ph-trophy`     | Success (green) |
| Defeat   | `ph-smiley-sad` | Error (red)     |
| Draw     | `ph-handshake`  | Primary (brand) |
| Fallback | `ph-flag`       | Primary (brand) |

#### Scenario: Victory icon

- **WHEN** the player wins by checkmate
- **THEN** the game-end modal displays a `ph-trophy` icon in the success colour
- **AND** the icon animates with the `modalIconPop` keyframe

#### Scenario: Defeat icon

- **WHEN** the player loses by checkmate
- **THEN** the game-end modal displays a `ph-smiley-sad` icon in the error colour

#### Scenario: Draw icon

- **WHEN** the game ends in a stalemate or draw
- **THEN** the game-end modal displays a `ph-handshake` icon in the primary colour

### Requirement: Engine-agnostic translation boundary

The `js/` layer SHALL remain framework-agnostic. BoardView SHALL accept an
optional `t` i18n object; status text from GameState SHALL be translated in the
`useGameStore` composable.

#### Scenario: BoardView defaults to English

- **WHEN** a `BoardView` instance is created without a `t` i18n object
- **THEN** piece ARIA labels use English descriptions

#### Scenario: BoardView uses provided translations

- **WHEN** a `BoardView` instance receives a Lithuanian `t` i18n object
- **THEN** piece ARIA labels use Lithuanian descriptions

### Requirement: Thinking status visibility

Detailed thinking status (chip plus depth / nodes / elapsed time) SHALL appear
only when uncapped strength is enabled. For capped levels 1–6 the navbar
thinking indicator MAY blink while the engine is busy, but the status panel
SHALL NOT show depth / nodes / time metrics. The uncapped think-time control
SHALL allow 1–180 seconds. On viewports at or below the stacked-board
breakpoint (991px), uncapped thinking details SHALL render between New Game
and Play as while the engine is busy.

#### Scenario: Capped levels hide detailed thinking

- **WHEN** uncapped is off and the computer is thinking
- **THEN** the navbar brain indicator is active
- **AND** the status panel does not show depth / nodes / time metrics

#### Scenario: Uncapped shows detailed thinking

- **WHEN** uncapped is on and the computer is thinking
- **THEN** depth / nodes / elapsed time are visible
- **AND** on mobile they appear between New Game and Play as

#### Scenario: Think-time slider max is 180 seconds

- **WHEN** uncapped is enabled
- **THEN** the think-time slider maximum is 180 seconds

### Requirement: First-visit play defaults

On a first visit with no saved play settings, the app SHALL default computer
strength to level 4 and Play as to White. Returning users SHALL keep values
persisted under `sdc-difficulty` and `sdc-color`.

#### Scenario: Fresh visitor defaults

- **WHEN** a new user loads the app with no `sdc-difficulty` or `sdc-color` keys
- **THEN** the strength control shows level 4
- **AND** Play as White is selected

#### Scenario: Persisted settings win

- **WHEN** a returning user has `sdc-difficulty` and/or `sdc-color` set
- **THEN** those stored values are restored instead of the first-visit defaults
