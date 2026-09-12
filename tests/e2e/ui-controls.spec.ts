import { test, expect } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

/**
 * UI Controls Tests
 * Tests for theme switching, difficulty selection, and color choice
 */

test.describe("UI Controls", () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
  });

  test.describe("Theme Switching", () => {
    test("should have a theme mode toggle and no customizer", async ({ page }) => {
      await expect(page.locator("#theme-toggle-btn")).toBeVisible();
      await expect(page.locator("[data-theme-customizer-trigger]")).toHaveCount(0);
    });

    test("should lock chrome and primary over prior localStorage", async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem("sdc-theme-preference", "light");
        localStorage.setItem("sdc-palette", "fibonacci");
        localStorage.setItem("sdc-neutral-color", "charcoal");
        localStorage.setItem("sdc-radius", "0.5");
        localStorage.setItem("sdc-font-preference", "lato");
        localStorage.setItem("sdc-primary-color", "violet");
      });
      await page.reload();

      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect(page.locator("html")).toHaveAttribute("data-palette", "open-color");
      await expect(page.locator("html")).toHaveAttribute("data-neutral", "stone");
      await expect(page.locator("html")).toHaveAttribute("data-radius", "0.375");
      await expect(page.locator("html")).toHaveAttribute("data-font", "ubuntu");
      await expect(page.locator("html")).toHaveAttribute("data-primary", "black");

      const stored = await page.evaluate(() => ({
        theme: localStorage.getItem("sdc-theme-preference"),
        palette: localStorage.getItem("sdc-palette"),
        neutral: localStorage.getItem("sdc-neutral-color"),
        radius: localStorage.getItem("sdc-radius"),
        font: localStorage.getItem("sdc-font-preference"),
        primary: localStorage.getItem("sdc-primary-color"),
        vanduoKeys: Object.keys(localStorage).filter((k) => k.startsWith("vanduo-")),
      }));
      expect(stored.vanduoKeys).toEqual([]);
      expect(stored).toMatchObject({
        theme: "light",
        palette: "open-color",
        neutral: "stone",
        radius: "0.375",
        font: "ubuntu",
        primary: "black",
      });
    });

    test("should cycle to Light theme", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("sdc-theme-preference", "system"));
      await page.reload();
      await page.click("#theme-toggle-btn");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    });

    test("should cycle to Dark theme", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("sdc-theme-preference", "light"));
      await page.reload();
      await page.click("#theme-toggle-btn");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    });

    test("should cycle to System theme", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("sdc-theme-preference", "dark"));
      await page.reload();
      await page.click("#theme-toggle-btn");
      await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    });
  });

  test.describe("Locale Switching", () => {
    test("should show Mode Toggle morph in the header", async ({ page }) => {
      const toggle = page.locator(".header-right [data-locale-toggle]");
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-label", "Switch to Lithuanian");
      await expect(page.locator(".app-title-text")).toHaveText("Spindrift Chess");
    });

    test("should switch UI to Lithuanian and persist locale", async ({ page }) => {
      const toggle = page.locator(".header-right [data-locale-toggle]");
      await toggle.click();

      await expect(page.locator(".app-title-text")).toHaveText("Spindrift Šachmatai");
      await expect(toggle).toHaveAttribute("aria-label", "Perjungti į anglų");

      const stored = await page.evaluate(() => localStorage.getItem("sdc-locale"));
      expect(stored).toBe("lt");
    });

    test("should restore Lithuanian after reload", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("sdc-locale", "lt"));
      await page.reload();

      await expect(page.locator(".app-title-text")).toHaveText("Spindrift Šachmatai");
      await expect(page.locator(".header-right [data-locale-toggle]")).toHaveAttribute(
        "aria-label",
        "Perjungti į anglų",
      );
    });

    test("should keep locale morph toggle in the header on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 540, height: 960 });
      await expect(page.locator(".header-right [data-locale-toggle]")).toBeVisible();
      await expect(page.locator(".header-menu [data-locale-toggle]")).toHaveCount(0);
    });
  });

  test.describe("Difficulty Selection", () => {
    test("should show Computer strength slider (levels 1–6)", async ({ page }) => {
      const slider = page.locator("#strength-slider");
      await expect(slider).toBeVisible();
      await expect(slider).toHaveAttribute("min", "1");
      await expect(slider).toHaveAttribute("max", "6");
      await expect(page.getByText("Computer strength", { exact: true })).toBeVisible();
    });

    test("should default to level 4", async ({ page }) => {
      await expect(page.locator("#strength-slider")).toHaveValue("4");
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
      await page.getByText("Uncapped computer strength").click();
      await expect(page.locator("#strength-slider")).toHaveCount(0);
      await expect(page.locator("#think-time-slider")).toBeVisible();
      await expect(page.locator("#think-time-slider")).toHaveAttribute("min", "1");
      await expect(page.locator("#think-time-slider")).toHaveAttribute("max", "180");
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

      await expect(whiteBtn).toHaveClass(/vd-is-active/);
      await expect(randomBtn).not.toHaveClass(/vd-is-active/);

      await blackBtn.click();
      await expect(blackBtn).toHaveClass(/vd-is-active/);
      await expect(whiteBtn).not.toHaveClass(/vd-is-active/);
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
