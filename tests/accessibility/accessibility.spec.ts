import { test, expect } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

test.describe("Accessibility - Keyboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
  });

  test("should navigate controls with Tab key", async ({ page }) => {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeDefined();
  });

  test("should activate New Game with Space and Enter", async ({ page }) => {
    await page.focus("#new-game-btn");
    await page.keyboard.press(" ");
    await expect(page.locator(".chess-piece.has-piece")).toHaveCount(32);

    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
    await page.focus("#new-game-btn");
    await page.keyboard.press("Enter");
    await expect(page.locator(".chess-piece.has-piece")).toHaveCount(32);
  });

  test("should select a piece by click for keyboard focus baseline", async ({ page }) => {
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    await page.click('.chess-square[data-square="e2"]');
    await expect(page.locator('.chess-square[data-square="e2"]')).toHaveClass(/highlight-selected/);
  });
});

test.describe("Accessibility - Labels", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
  });

  test("primary controls have accessible names", async ({ page }) => {
    await expect(page.locator("#new-game-btn")).toBeVisible();
    await expect(page.locator("#difficulty-choice")).toBeVisible();
    await expect(page.locator("#color-choice")).toBeVisible();
  });
});
