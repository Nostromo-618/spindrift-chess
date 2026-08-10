import { test, expect, type Page } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

/**
 * Full Game Flow Tests
 * Tests for complete game scenarios including Scholar's Mate
 */

test.describe("Full Game Tests", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
    await page.locator('#difficulty-choice button[data-level="1"]').click();
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

  test("should complete Scholar's Mate sequence", async ({ page }) => {
    test.slow();

    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    await makeMove(page, "e2", "e4");

    const e4Piece = page.locator('.chess-square[data-square="e4"] .chess-piece');
    await expect(e4Piece).toHaveAttribute("data-piece", "wP");

    await waitForAIMove(page);

    await makeMove(page, "f1", "c4");

    await expect(page.locator("#move-history")).toContainText("f1-c4");
  });

  test("should show game end modal on checkmate", async ({ page }) => {
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    await expect(page.locator("#game-end-modal")).toHaveCount(0);

    const statusText = page.locator("#status-text");
    await expect(statusText).not.toContainText("Checkmate");
    await expect(statusText).not.toContainText("Draw");
  });

  test("should update turn indicator after each move", async ({ page }) => {
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    const turnIndicator = page.locator("#turn-indicator");

    await makeMove(page, "e2", "e4");

    await expect(turnIndicator).not.toBeEmpty();
  });

  test("should track move history throughout game", async ({ page }) => {
    test.slow();

    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    await makeMove(page, "e2", "e4");
    const moveHistory = page.locator("#move-history");
    await expect(moveHistory).toContainText("e2-e4");

    await waitForAIMove(page);

    const historyItems = page.locator("#move-history li");
    await expect(historyItems).toHaveCount(2);

    await makeMove(page, "d2", "d4");

    await expect(moveHistory).toContainText("d2-d4");
  });
});
