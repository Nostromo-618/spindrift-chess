import { test, expect } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

/**
 * Piece Movement Tests
 * Tests for selecting pieces, showing legal moves, and executing moves
 */

test.describe("Piece Movement", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    await page.evaluate(() => {
      // Keep these movement tests focused on the player's move.
      window.requestAnimationFrame = () => 0;
    });
  });

  test("should highlight selected piece", async ({ page }) => {
    const e2Square = page.locator('.chess-square[data-square="e2"]');
    await e2Square.click();

    await expect(e2Square).toHaveClass(/highlight-selected/);
  });

  test("should show legal move indicators when piece is selected", async ({ page }) => {
    const e2Square = page.locator('.chess-square[data-square="e2"]');
    await e2Square.click();

    const e3Square = page.locator('.chess-square[data-square="e3"]');
    const e4Square = page.locator('.chess-square[data-square="e4"]');

    await expect(e3Square).toHaveClass(/highlight-legal/);
    await expect(e4Square).toHaveClass(/highlight-legal/);
  });

  test("should execute move when clicking legal target square", async ({ page }) => {
    const e2Square = page.locator('.chess-square[data-square="e2"]');
    const e2Piece = e2Square.locator(".chess-piece");

    await e2Square.click();

    const e4Square = page.locator('.chess-square[data-square="e4"]');
    await e4Square.click();

    const e4Piece = e4Square.locator(".chess-piece");
    await expect(e4Piece).toHaveAttribute("data-piece", "wP");

    await expect(e2Piece).not.toHaveClass("has-piece");
  });

  test("should highlight last move squares", async ({ page }) => {
    await page.click('.chess-square[data-square="e2"]');
    await page.click('.chess-square[data-square="e4"]');

    const e2Square = page.locator('.chess-square[data-square="e2"]');
    const e4Square = page.locator('.chess-square[data-square="e4"]');

    await expect(e2Square).toHaveClass(/highlight-last-move/);
    await expect(e4Square).toHaveClass(/highlight-last-move/);
  });

  test("should clear selection when clicking empty square without move", async ({ page }) => {
    await page.click('.chess-square[data-square="e2"]');

    const e2Square = page.locator('.chess-square[data-square="e2"]');
    await expect(e2Square).toHaveClass(/highlight-selected/);

    await page.click('.chess-square[data-square="a6"]');

    await expect(e2Square).not.toHaveClass(/highlight-selected/);
  });

  test("should add move to history after making a move", async ({ page }) => {
    await page.click('.chess-square[data-square="e2"]');
    await page.click('.chess-square[data-square="e4"]');

    const moveHistory = page.locator("#move-history");
    await expect(moveHistory).toContainText("e2-e4");
  });

  test("should show knight legal moves correctly", async ({ page }) => {
    const g1Square = page.locator('.chess-square[data-square="g1"]');
    await g1Square.click();

    const f3Square = page.locator('.chess-square[data-square="f3"]');
    const h3Square = page.locator('.chess-square[data-square="h3"]');

    await expect(f3Square).toHaveClass(/highlight-legal/);
    await expect(h3Square).toHaveClass(/highlight-legal/);
  });

  test("should switch selection when clicking different own piece", async ({ page }) => {
    await page.click('.chess-square[data-square="e2"]');
    const e2Square = page.locator('.chess-square[data-square="e2"]');
    await expect(e2Square).toHaveClass(/highlight-selected/);

    await page.click('.chess-square[data-square="d2"]');
    const d2Square = page.locator('.chess-square[data-square="d2"]');

    await expect(d2Square).toHaveClass(/highlight-selected/);
    await expect(e2Square).not.toHaveClass(/highlight-selected/);
  });
});
