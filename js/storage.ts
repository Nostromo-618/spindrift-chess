/**
 * storage.ts
 *
 * Centralised localStorage manager for Spindrift Chess.
 * All keys are namespaced under "sdc-" to avoid collisions.
 *
 * Keys:
 *   sdc-disclaimer-accepted  "true" when user has accepted the disclaimer
 *   sdc-theme                "system" | "light" | "dark"
 *   sdc-difficulty           "1" … "6"
 *   sdc-game                 JSON string of GameState.serialize()
 *   sdc-board-size           "0" … "100" desktop board width slider
 *   sdc-color                "white" | "black" | "random"
 */

const KEYS = {
  DISCLAIMER: "sdc-disclaimer-accepted",
  THEME: "sdc-theme",
  DIFFICULTY: "sdc-difficulty",
  GAME: "sdc-game",
  BOARD_SIZE: "sdc-board-size",
  COLOR: "sdc-color",
} as const;

export type ThemePreference = "system" | "light" | "dark";
export type ColorChoice = "white" | "black" | "random";

/** Minimal shape required to accept a saved game blob. */
export interface SerializedGame {
  board: unknown;
  activeColor: string;
  [key: string]: unknown;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage might be full or unavailable (private browsing restrictions etc.)
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Disclaimer ──────────────────────────────────────────────────────────────

export function getDisclaimerAccepted(): boolean {
  return read(KEYS.DISCLAIMER) === "true";
}

export function setDisclaimerAccepted(): void {
  write(KEYS.DISCLAIMER, "true");
}

// ── Theme ────────────────────────────────────────────────────────────────────

export function getTheme(): ThemePreference {
  const val = read(KEYS.THEME);
  if (val === "light" || val === "dark") return val;
  return "system";
}

export function setTheme(theme: ThemePreference): void {
  const safe: ThemePreference = theme === "light" || theme === "dark" ? theme : "system";
  write(KEYS.THEME, safe);
  // Keep Vanduo's own key in sync so its theme customizer reads correctly
  write("vanduo-theme-preference", safe);
}

// ── Play color (white / black / random) ─────────────────────────────────────

export function getColorChoice(): ColorChoice | null {
  const v = read(KEYS.COLOR);
  if (v === "white" || v === "black" || v === "random") return v;
  return null;
}

export function setColorChoice(color: ColorChoice): void {
  if (color === "white" || color === "black" || color === "random") {
    write(KEYS.COLOR, color);
  }
}

// ── Difficulty ───────────────────────────────────────────────────────────────

/** 1–6, or null if not set / invalid */
export function getDifficulty(): number | null {
  const raw = read(KEYS.DIFFICULTY);
  if (raw === null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 1 || n > 6) return null;
  return n;
}

export function setDifficulty(level: number): void {
  const clamped = Math.max(1, Math.min(6, Number(level) || 6));
  write(KEYS.DIFFICULTY, String(clamped));
}

// ── Game progress ─────────────────────────────────────────────────────────────

export function getGame(): SerializedGame | null {
  const raw = read(KEYS.GAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SerializedGame;
    if (!parsed || !parsed.board || !parsed.activeColor) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setGame(serialized: SerializedGame | null | undefined): void {
  if (!serialized) return;
  try {
    write(KEYS.GAME, JSON.stringify(serialized));
  } catch {
    // If serialization fails (unlikely), skip silently
  }
}

/** Remove any saved in-progress game. */
export function clearGame(): void {
  remove(KEYS.GAME);
}

// ── Desktop board size (range 0–100) ─────────────────────────────────────────

/** 0–100, or null if not set */
export function getBoardSize(): number | null {
  const raw = read(KEYS.BOARD_SIZE);
  if (raw === null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return Math.round(n);
}

export function setBoardSize(value: number): void {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  write(KEYS.BOARD_SIZE, String(clamped));
}
