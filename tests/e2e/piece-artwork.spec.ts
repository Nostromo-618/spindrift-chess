import { test, expect } from "@playwright/test";
import { acceptDisclaimer } from "../utils/test-utils";

for (const width of [320, 375, 1280]) {
  test(`board preserves SVG proportions at ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await acceptDisclaimer(page);
    await page.locator('#color-choice button[data-color="white"]').click();
    await page.locator("#new-game-btn").click();
    const images = page.locator(".chess-piece-img");
    await expect(images).toHaveCount(32);
    await images.evaluateAll((elements) =>
      Promise.all(elements.map((img) => (img as HTMLImageElement).decode())),
    );
    const sizes = await images.evaluateAll((elements) =>
      elements.map((element) => {
        const img = element as HTMLImageElement;
        const image = img.getBoundingClientRect();
        const square = img.closest(".chess-square")!.getBoundingClientRect();
        const matrix = new DOMMatrixReadOnly(getComputedStyle(img).transform);
        return {
          code: img.closest(".chess-piece")!.getAttribute("data-piece")!.slice(1),
          loaded: img.complete && img.naturalWidth > 0,
          x: image.width / square.width,
          y: image.height / square.height,
          shearX: matrix.b,
          shearY: matrix.c,
        };
      }),
    );
    const originalHeights: Record<string, number> = {
      K: 90.2,
      Q: 88,
      B: 89.5,
      N: 89.3,
      R: 88.5,
      P: 88.3,
    };
    const fideHeights: Record<string, number> = { K: 95, Q: 85, B: 70, N: 60, R: 55, P: 50 };
    for (const size of sizes) {
      expect(size.loaded).toBe(true);
      // Match the accepted halfway study, without stretching either axis.
      const height = originalHeights[size.code]!;
      const expected = (height + (90.2 * fideHeights[size.code]!) / 95) / 2 / height;
      expect(size.x).toBeCloseTo(expected, 4);
      expect(size.y).toBeCloseTo(expected, 4);
      expect(size.shearX).toBe(0);
      expect(size.shearY).toBe(0);
    }
  });
}
