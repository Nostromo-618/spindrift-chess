import { test, expect, type Page } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

/**
 * UI Controls Tests
 * Tests for theme switching, difficulty selection, and color choice
 */

test.describe("UI Controls", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
  });

  // Open vd3's VdThemeCustomizer via the header paint-roller (desktop) or the
  // mobile offcanvas ("Customize theme").
  async function openThemeCustomizer(page: Page): Promise<void> {
    const deskBtn = page.locator(
      '.header-controls .header-icon-btn[aria-label="Open theme customizer"]',
    );
    if (await deskBtn.isVisible()) {
      await deskBtn.click();
      return;
    }
    await page.locator("#mobile-menu-toggle").click();
    await page.getByRole("button", { name: "Customize theme" }).click();
  }

  test.describe("Theme Switching", () => {
    test("should have a theme customizer control", async ({ page }) => {
      const deskBtn = page.locator(
        '.header-controls .header-icon-btn[aria-label="Open theme customizer"]',
      );
      const mobileToggle = page.locator("#mobile-menu-toggle");
      expect((await deskBtn.isVisible()) || (await mobileToggle.isVisible())).toBeTruthy();
    });

    test("should open the theme customizer panel", async ({ page }) => {
      await openThemeCustomizer(page);
      await expect(page.locator(".vd-theme-customizer-panel")).toHaveClass(/is-open/);
      await expect(page.getByText("Customize Theme")).toBeVisible();
    });

    test("should cycle to Light theme", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("vanduo-theme-preference", "system"));
      await page.reload();
      await page.click("#theme-toggle-btn");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    });

    test("should cycle to Dark theme", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("vanduo-theme-preference", "light"));
      await page.reload();
      await page.click("#theme-toggle-btn");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    });

    test("should cycle to System theme", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("vanduo-theme-preference", "dark"));
      await page.reload();
      await page.click("#theme-toggle-btn");
      await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    });
  });

  test.describe("Difficulty Selection", () => {
    test("should show Spindrift strength slider (levels 1–6)", async ({ page }) => {
      const slider = page.locator("#strength-slider");
      await expect(slider).toBeVisible();
      await expect(slider).toHaveAttribute("min", "1");
      await expect(slider).toHaveAttribute("max", "6");
      await expect(page.getByText("Spindrift strength", { exact: true })).toBeVisible();
    });

    test("should default to level 3", async ({ page }) => {
      await expect(page.locator("#strength-slider")).toHaveValue("3");
    });

    test("should allow changing difficulty", async ({ page }) => {
      for (const level of ["1", "2", "3", "4", "5", "6"]) {
        await page.locator("#strength-slider").fill(level);
        await expect(page.locator("#strength-slider")).toHaveValue(level);
      }
    });

    test("uncapped switch reveals thinking-time slider", async ({ page }) => {
      const strengthBlock = page.locator("#difficulty-choice");
      await strengthBlock.scrollIntoViewIfNeeded();
      await page.getByText("Uncapped Spindrift strength").click();
      await expect(page.locator("#strength-slider")).toHaveCount(0);
      await expect(page.locator("#think-time-slider")).toBeVisible();
      await expect(page.locator("#think-time-slider")).toHaveAttribute("min", "1");
      await expect(page.locator("#think-time-slider")).toHaveAttribute("max", "60");
    });
  });

  test.describe("Color Choice", () => {
    test("should have White, Black, and Random options", async ({ page }) => {
      const colorChoice = page.locator("#color-choice");

      await expect(colorChoice.locator('button[data-color="white"]')).toBeVisible();
      await expect(colorChoice.locator('button[data-color="black"]')).toBeVisible();
      await expect(colorChoice.locator('button[data-color="random"]')).toBeVisible();
    });

    test("should highlight active color choice", async ({ page }) => {
      const whiteBtn = page.locator('#color-choice button[data-color="white"]');
      const blackBtn = page.locator('#color-choice button[data-color="black"]');
      const randomBtn = page.locator('#color-choice button[data-color="random"]');

      await expect(randomBtn).toHaveClass(/vd-is-active/);
      await expect(whiteBtn).not.toHaveClass(/vd-is-active/);

      await blackBtn.click();
      await expect(blackBtn).toHaveClass(/vd-is-active/);
      await expect(randomBtn).not.toHaveClass(/vd-is-active/);
    });

    test("should start game with selected color", async ({ page }) => {
      await page.locator('#color-choice button[data-color="black"]').click();

      await page.click("#new-game-btn");
      await page.waitForSelector('.chess-piece[data-piece="wP"]');

      const a8Square = page.locator('.chess-square[data-square="a8"]');
      const a8Order = await a8Square.evaluate((el) => window.getComputedStyle(el).order);

      expect(parseInt(a8Order, 10)).toBeGreaterThan(32);
    });
  });

  test.describe("Promotion Picker Overlay", () => {
    test("should not show promotion picker initially", async ({ page }) => {
      const picker = page.locator(".promotion-picker");
      await expect(picker).toHaveCount(0);
    });
  });
});
