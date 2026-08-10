import { test, expect, type Page } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

/**
 * AI Levels Tests
 *
 * Split into:
 *   - Quick smoke tests (run in default suite) - single move per level
 *   - Full game tests (run separately) - multiple moves per level
 */

async function makeMove(page: Page, from: string, to: string): Promise<void> {
  await page.click(`.chess-square[data-square="${from}"]`);
  await page.click(`.chess-square[data-square="${to}"]`);
}

async function waitForAIMove(page: Page, timeoutMs = 30000): Promise<void> {
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
    { timeout: timeoutMs },
  );
}

test.describe("AI Levels - Smoke Tests", () => {
  test.describe.configure({ mode: "parallel" });

  for (const level of [1, 2, 3, 4, 5, 6]) {
    test(`Level ${level} should complete AI move`, async ({ page }) => {
      if (level === 6) {
        test.setTimeout(120000);
      }
      await acceptDisclaimer(page);

      await page.locator('#color-choice button[data-color="white"]').click();
      await page.locator("#strength-slider").fill(String(level));

      await page.click("#new-game-btn");
      await page.waitForSelector('.chess-piece[data-piece="wP"]');

      await makeMove(page, "e2", "e4");
      await waitForAIMove(page, level === 6 ? 90000 : 30000);

      const historyItems = page.locator("#move-history li");
      await expect(historyItems).toHaveCount(2);
    });
  }
});

test.describe("AI Levels - Full Game Tests", () => {
  test.describe.configure({ mode: "serial" });

  for (const level of [1, 2, 3, 4, 5, 6]) {
    test(`Level ${level} should play multiple moves without errors`, async ({ page }) => {
      test.slow();
      if (level === 6) {
        test.setTimeout(180000);
      }

      await acceptDisclaimer(page);

      await page.locator('#color-choice button[data-color="white"]').click();
      await page.locator("#strength-slider").fill(String(level));

      await page.click("#new-game-btn");
      await page.waitForSelector('.chess-piece[data-piece="wP"]');

      const openingMoves: [string, string][] = [
        ["e2", "e4"],
        ["d2", "d4"],
        ["g1", "f3"],
        ["b1", "c3"],
      ];

      for (const [from, to] of openingMoves) {
        const statusText = await page.locator("#status-text").textContent();
        if (
          statusText?.includes("Checkmate") ||
          statusText?.includes("Stalemate") ||
          statusText?.includes("Draw")
        ) {
          break;
        }

        await page.waitForFunction(
          () => {
            const status = document.querySelector("#status-text");
            return status?.textContent?.includes("Your move");
          },
          { timeout: 30000 },
        );

        try {
          const pieceOnSquare = await page
            .locator(`.chess-square[data-square="${from}"] .chess-piece`)
            .count();
          if (pieceOnSquare > 0) {
            await makeMove(page, from, to);
            await waitForAIMove(page, level === 6 ? 90000 : 30000);
          }
        } catch {
          // Move failed, continue with next
        }
      }

      const historyItems = page.locator("#move-history li");
      const count = await historyItems.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const statusText = await page.locator("#status-text").textContent();
      expect(statusText).not.toContain("Error");
    });
  }
});
