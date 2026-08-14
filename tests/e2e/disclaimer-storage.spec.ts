import { test, expect, type Page } from "@playwright/test";
import { acceptDisclaimer, DISCLAIMER_KEY } from "../utils/test-utils";

/**
 * Disclaimer Modal + LocalStorage Persistence Tests
 *
 * These tests verify:
 *  1. Disclaimer shows on first visit
 *  2. Disclaimer is mandatory (backdrop / ESC don't close it)
 *  3. Accept persists to localStorage and hides the modal
 *  4. Disclaimer doesn't show on subsequent visits
 *  5. Difficulty persists across reloads
 *  6. Game progress saves and restores
 *  7. New Game clears saved progress
 */

async function freshPage(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.describe("Disclaimer Modal", () => {
  test("shows on first visit", async ({ page }) => {
    await freshPage(page);

    const modal = page.locator("#disclaimer-modal");
    await expect(modal).toBeVisible();
  });

  test("displays title and accept button", async ({ page }) => {
    await freshPage(page);

    await expect(page.locator("#disclaimer-modal-title")).toContainText("Spindrift Chess");
    await expect(page.locator("#disclaimer-accept-btn")).toBeVisible();
  });

  test("cannot be closed with ESC key", async ({ page }) => {
    await freshPage(page);

    const modal = page.locator("#disclaimer-modal");
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(modal).toBeVisible();
  });

  test("cannot be closed by clicking the backdrop", async ({ page }) => {
    await freshPage(page);

    const modal = page.locator("#disclaimer-modal");
    await expect(modal).toBeVisible();

    await page.mouse.click(10, 10);

    await expect(modal).toBeVisible();
  });

  test("Accept button closes modal and sets localStorage", async ({ page }) => {
    await freshPage(page);

    await page.click("#disclaimer-accept-btn");

    const modal = page.locator("#disclaimer-modal");
    await expect(modal).not.toBeVisible();

    const accepted = await page.evaluate((key) => localStorage.getItem(key), DISCLAIMER_KEY);
    expect(accepted).toBe("true");
  });

  test("does NOT show on subsequent visits", async ({ page }) => {
    await acceptDisclaimer(page);

    await page.waitForSelector("#board-container");

    const modal = page.locator("#disclaimer-modal");
    const exists = await modal.count();
    if (exists > 0) {
      await expect(modal).not.toBeVisible();
    }
  });
});

test.describe("LocalStorage: Difficulty Persistence", () => {
  test("saves selected difficulty to localStorage", async ({ page }) => {
    await acceptDisclaimer(page);

    await page.locator("#strength-slider").fill("4");
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    const saved = await page.evaluate(() => localStorage.getItem("sdc-difficulty"));
    expect(saved).toBe("4");
  });

  test("restores saved difficulty on page reload", async ({ page }) => {
    await acceptDisclaimer(page);

    await page.evaluate(() => localStorage.setItem("sdc-difficulty", "5"));
    await page.reload();

    await expect(page.locator("#strength-slider")).toHaveValue("5");
  });
});

test.describe("LocalStorage: Game Progress", () => {
  test("saves game state to localStorage after starting a game", async ({ page }) => {
    await acceptDisclaimer(page);

    await page.locator('#color-choice button[data-color="white"]').click();
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    await page.click('.chess-square[data-square="e2"]');
    await page.click('.chess-square[data-square="e4"]');

    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("sdc-game");
        if (!raw) return false;
        try {
          return JSON.parse(raw).board != null;
        } catch {
          return false;
        }
      },
      { timeout: 5000 },
    );

    const saved = await page.evaluate(() => localStorage.getItem("sdc-game"));
    expect(saved).not.toBeNull();

    const parsed = JSON.parse(saved!);
    expect(parsed).toHaveProperty("board");
    expect(parsed).toHaveProperty("activeColor");
  });

  test("restores saved game on reload", async ({ page }) => {
    await acceptDisclaimer(page);

    await page.locator('#color-choice button[data-color="white"]').click();
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    await page.click('.chess-square[data-square="e2"]');
    await page.click('.chess-square[data-square="e4"]');

    await expect(page.locator("#move-history")).toContainText("e2-e4");

    await page.reload();

    const pieces = page.locator(".chess-piece");
    await expect(pieces.first()).toBeVisible();
  });

  test("New Game clears saved game from localStorage", async ({ page }) => {
    await acceptDisclaimer(page);

    await page.locator('#color-choice button[data-color="white"]').click();
    await page.click("#new-game-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');
    await page.click('.chess-square[data-square="e2"]');
    await page.click('.chess-square[data-square="e4"]');
    await page.waitForFunction(
      () => {
        const t = document.querySelector("#status-text")?.textContent || "";
        return t.includes("Your move");
      },
      { timeout: 30000 },
    );

    await page.click("#new-game-btn");
    await expect(page.locator("#new-game-confirm-modal")).toBeVisible();
    await page.click("#new-game-confirm-btn");
    await page.waitForSelector('.chess-piece[data-piece="wP"]');

    const saved = await page.evaluate(() => localStorage.getItem("sdc-game"));
    if (saved) {
      const parsed = JSON.parse(saved);
      expect(parsed.moveHistory).toHaveLength(0);
    }
  });

  test("completed game clears saved progress", async ({ page }) => {
    await acceptDisclaimer(page);

    const terminalState = {
      board: new Array(64).fill(null),
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
      result: { outcome: "checkmate", winner: "black" },
      lastMove: null,
      repetitionMap: [],
    };
    await page.evaluate((state) => {
      localStorage.setItem("sdc-disclaimer-accepted", "true");
      localStorage.setItem("sdc-game", JSON.stringify(state));
    }, terminalState);

    await page.reload();
    await page.waitForSelector("#board-container");

    const saved = await page.evaluate(() => localStorage.getItem("sdc-game"));
    expect(saved).toBeNull();
  });
});
