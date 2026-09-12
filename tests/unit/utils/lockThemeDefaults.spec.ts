import { describe, it, expect } from "vitest";
import {
  LOCKED_THEME_CHROME,
  lockedPrimaryForTheme,
  withLockedThemeChrome,
} from "../../../js/utils/lockThemeDefaults.js";

describe("lockedPrimaryForTheme", () => {
  it("maps dark to amber and everything else to black", () => {
    expect(lockedPrimaryForTheme("dark")).toBe("amber");
    expect(lockedPrimaryForTheme("light")).toBe("black");
    expect(lockedPrimaryForTheme("system")).toBe("black");
  });
});

describe("withLockedThemeChrome", () => {
  it("overwrites palette, neutral, radius, font, and primary; keeps theme", () => {
    const result = withLockedThemeChrome({
      palette: "fibonacci",
      theme: "dark",
      primary: "violet",
      neutral: "charcoal",
      radius: "0.5",
      font: "lato",
    });

    expect(result).toEqual({
      palette: LOCKED_THEME_CHROME.palette,
      theme: "dark",
      primary: "amber",
      neutral: LOCKED_THEME_CHROME.neutral,
      radius: LOCKED_THEME_CHROME.radius,
      font: LOCKED_THEME_CHROME.font,
    });
  });

  it("forces black primary for light/system even when chrome already matches", () => {
    const result = withLockedThemeChrome({
      palette: "open-color",
      theme: "light",
      primary: "teal",
      neutral: "stone",
      radius: "0.375",
      font: "ubuntu",
    });

    expect(result.primary).toBe("black");
    expect(result.theme).toBe("light");
  });
});
