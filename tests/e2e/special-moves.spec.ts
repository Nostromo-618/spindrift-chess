import { test, expect, type Page } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

/**
 * Special Moves Tests
 * Tests for castling, en passant, and pawn promotion
 */

test.describe("Special Moves", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
    await page.locator("#strength-slider").fill("1");
  });

  async function makeMove(page: Page, from: string, to: string): Promise<void> {
    await page.click(`.chess-square[data-square="${from}"]`);
    await page.click(`.chess-square[data-square="${to}"]`);
  }

  async function waitForAIMove(page: Page): Promise<void> {
    await page.waitForFunction(
      () => {
        const status = document.querySelector("#status-text");
        if (!status) return false;
        const text = status.textContent || "";
        return (
          text.includes("Your move") ||
          text.includes("Checkmate") ||
          text.includes("Stalemate") ||
          text.includes("Draw")
        );
      },
      { timeout: 30000 },
    );
  }

  test("should show kingside castling as legal move", async ({ page }) => {
    test.slow();

    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    await makeMove(page, "e2", "e4");
    await waitForAIMove(page);

    await makeMove(page, "g1", "f3");
    await waitForAIMove(page);

    await makeMove(page, "f1", "c4");
    await waitForAIMove(page);

    await page.click('.chess-square[data-square="e1"]');

    const g1Square = page.locator('.chess-square[data-square="g1"]');
    await expect(g1Square).toHaveClass(/highlight-legal/);
  });

  test("should execute kingside castling", async ({ page }) => {
    test.slow();

    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    await makeMove(page, "e2", "e4");
    await waitForAIMove(page);

    await makeMove(page, "g1", "f3");
    await waitForAIMove(page);

    await makeMove(page, "f1", "c4");
    await waitForAIMove(page);

    await makeMove(page, "e1", "g1");

    const g1Piece = page.locator('.chess-square[data-square="g1"] .chess-piece');
    await expect(g1Piece).toHaveAttribute("data-piece", "wK");

    const f1Piece = page.locator('.chess-square[data-square="f1"] .chess-piece');
    await expect(f1Piece).toHaveAttribute("data-piece", "wR");
  });

  test("should show pawn double-move from starting position", async ({ page }) => {
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    await page.click('.chess-square[data-square="a2"]');

    const a3Square = page.locator('.chess-square[data-square="a3"]');
    const a4Square = page.locator('.chess-square[data-square="a4"]');

    await expect(a3Square).toHaveClass(/highlight-legal/);
    await expect(a4Square).toHaveClass(/highlight-legal/);
  });

  test("should prevent pawn double-move after first move", async ({ page }) => {
    test.slow();

    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    await makeMove(page, "a2", "a3");
    await waitForAIMove(page);

    await makeMove(page, "e2", "e4");
    await waitForAIMove(page);

    await page.click('.chess-square[data-square="a3"]');

    const a4Square = page.locator('.chess-square[data-square="a4"]');
    const a5Square = page.locator('.chess-square[data-square="a5"]');

    await expect(a4Square).toHaveClass(/highlight-legal/);
    await expect(a5Square).not.toHaveClass(/highlight-legal/);
  });

  test("should capture diagonally with pawn", async ({ page }) => {
    // Deterministic setup: do not rely on AI replies (e5 can end blocked with 0 moves).
    const board = new Array(64).fill(null);
    board[4] = "wK"; // e1
    board[60] = "bK"; // e8
    board[36] = "wP"; // e5
    board[43] = "bP"; // d6 — diagonal capture target

    await page.evaluate(
      (saved) => {
        localStorage.setItem("sdc-game", JSON.stringify(saved));
        localStorage.setItem("sdc-difficulty", "1");
        localStorage.setItem("sdc-color", "white");
      },
      {
        board,
        activeColor: "white",
        playerColor: "white",
        castlingRights: {
          white: { kingSide: false, queenSide: false },
          black: { kingSide: false, queenSide: false },
        },
        enPassantTarget: null,
        halfmoveClock: 0,
        fullmoveNumber: 1,
        moveHistory: [],
        result: null,
        lastMove: null,
        repetitionMap: [],
        reversibleHistory: [],
      },
    );
    await page.reload();

    await expect(
      page.locator('.chess-square[data-square="e5"] .chess-piece[data-piece="wP"]'),
    ).toBeVisible();
    await page.click('.chess-square[data-square="e5"]');

    const d6 = page.locator('.chess-square[data-square="d6"]');
    await expect(d6).toHaveClass(/highlight-legal/);

    await page.click('.chess-square[data-square="d6"]');
    await expect(
      page.locator('.chess-square[data-square="d6"] .chess-piece[data-piece="wP"]'),
    ).toBeVisible();
  });
});
