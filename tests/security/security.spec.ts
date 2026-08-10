import { test, expect } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

test.describe("Security - Input Validation", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
  });

  test("should validate difficulty input", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("sdc-difficulty", "999"));
    await page.reload();
    await expect(page.locator("#strength-slider")).toBeVisible();
    const level = await page.locator("#strength-slider").inputValue();
    expect(Number(level)).toBeGreaterThanOrEqual(1);
    expect(Number(level)).toBeLessThanOrEqual(6);
  });

  test("should not have promotion selector in DOM", async ({ page }) => {
    await expect(page.locator("#promotion-piece-select")).toHaveCount(0);
  });
});

test.describe("Security - XSS Prevention", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
  });

  test("should prevent XSS in move history", async ({ page }) => {
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    await page.evaluate(() => {
      localStorage.setItem(
        "sdc-game",
        JSON.stringify({
          board: new Array(64).fill(null),
          moveHistory: ['<script>alert("xss")</script>'],
          activeColor: "white",
        }),
      );
    });
    await page.reload();
    await page.waitForSelector("#board-container");
    await expect(page.locator("#move-history script")).toHaveCount(0);
    await expect(page.locator("#move-history")).toBeAttached();
  });

  test("should escape piece codes", async ({ page }) => {
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    const pieces = page.locator(".chess-piece.has-piece");
    const count = await pieces.count();
    for (let i = 0; i < count; i++) {
      const code = await pieces.nth(i).getAttribute("data-piece");
      expect(code).toMatch(/^[wb][PRNBQK]$/);
    }
  });
});

test.describe("Security - Storage Security", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
  });

  test("should only use sdc-/vanduo- storage keys", async ({ page }) => {
    const keys = await page.evaluate(() => Object.keys(localStorage));
    for (const key of keys) {
      expect(key).toMatch(/^(sdc-|vanduo-)/);
    }
  });

  test("should validate stored game JSON on load", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("sdc-game", "invalid json"));
    await page.reload();
    await page.waitForSelector("#board-container");
    const status = await page.locator("#status-text").textContent();
    expect(status).toBeTruthy();
  });
});
