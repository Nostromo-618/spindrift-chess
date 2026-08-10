/**
 * Test Utilities and Helpers
 *
 * Standalone helpers for building board states and move objects in tests.
 */

import type { Board, Color, Piece, Square } from "../../js/engine/types.js";

/** Accept disclaimer so Playwright e2e skips the modal. */
export const DISCLAIMER_KEY = "sdc-disclaimer-accepted";

export async function acceptDisclaimer(page: {
  goto: (url: string) => Promise<unknown>;
  evaluate: (fn: () => void) => Promise<unknown>;
  reload: () => Promise<unknown>;
}): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("sdc-disclaimer-accepted", "true");
  });
  await page.reload();
}

/** Set the Spindrift strength range slider (levels 1–6). */
export async function setStrengthLevel(
  page: {
    locator: (sel: string) => {
      fill: (v: string) => Promise<void>;
      inputValue: () => Promise<string>;
    };
  },
  level: number,
): Promise<void> {
  const slider = page.locator("#strength-slider");
  await slider.fill(String(level));
}

/**
 * Convert algebraic notation to board index.
 */
export function algebraicToIndex(square: string): number {
  if (square.length !== 2) return -1;
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return rank * 8 + file;
}

/**
 * Convert board index to algebraic notation.
 */
export function indexToAlgebraic(index: number): string {
  const file = String.fromCharCode(97 + (index % 8));
  const rank = String.fromCharCode(49 + Math.floor(index / 8));
  return file + rank;
}

export interface TestBoardState {
  board: Board;
  activeColor: Color;
  castlingRights: {
    white: { kingSide: boolean; queenSide: boolean };
    black: { kingSide: boolean; queenSide: boolean };
  };
  enPassantTarget: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}

/**
 * Build a 64-cell board array from a sparse piece list.
 */
export function createTestBoard({
  pieces = [],
  activeColor = "white",
  enPassantTarget = null,
}: {
  pieces?: string[];
  activeColor?: Color;
  enPassantTarget?: Square | null;
} = {}): TestBoardState {
  const board: Board = new Array(64).fill(null);
  for (const def of pieces) {
    const [square, piece] = def.split(":");
    if (square && piece) board[algebraicToIndex(square)] = piece as Piece;
  }
  return {
    board,
    activeColor,
    castlingRights: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    enPassantTarget,
    halfmoveClock: 0,
    fullmoveNumber: 1,
  };
}

/** In-memory localStorage for Vitest (Node) storage tests. */
export function installMemoryLocalStorage(): Storage {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

/**
 * Convert a flat a8→h1 diagram (64 cells, row-major from black's back rank) to
 * the engine's a1=0 board indexing.
 */
export function flatDiagramToBoard(flat64: (Piece | null)[]): Board {
  const b: Board = new Array(64).fill(null);
  for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
    const rank = 8 - diagramRow;
    for (let file = 0; file < 8; file++) {
      const piece = flat64[diagramRow * 8 + file];
      const idx = (rank - 1) * 8 + file;
      if (piece) b[idx] = piece;
    }
  }
  return b;
}
