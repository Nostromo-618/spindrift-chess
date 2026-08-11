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
- **THEN** every user-facing string (labels, buttons, modals, aria-labels,
  status text, piece descriptions) is displayed in Lithuanian

### Requirement: Brand protection

The word "Spindrift" SHALL be immutable across all locales. It SHALL NOT be
translated, transliterated, or altered in any way.

#### Scenario: App title in Lithuanian

- **WHEN** the active locale is Lithuanian
- **THEN** the app title in the header reads "Spindrift Šachmatai" (not "Šachmatai")

#### Scenario: Brand references in modal text

- **WHEN** modal text references the app name in Lithuanian
- **THEN** the text uses "Spindrift Šachmatai" while keeping the word
  "Spindrift" untranslated

### Requirement: Locale switcher in navbar

The app header SHALL display EN/LT pill buttons that SHALL allow toggling
between locales. The active locale SHALL be visually highlighted with the
primary colour.

#### Scenario: Desktop layout

- **WHEN** the viewport is >= 769px
- **THEN** the locale switcher appears in the header bar between the theme
  toggle and the header control buttons

#### Scenario: Mobile layout

- **WHEN** the viewport is < 769px
- **THEN** the locale switcher appears in the offcanvas menu

#### Scenario: Switching locale

- **WHEN** the user clicks the LT button
- **THEN** all UI text updates to Lithuanian immediately
- **THEN** the LT button becomes highlighted with the primary colour
- **THEN** the locale is persisted to localStorage

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
