/**
 * Spindrift locks all theme chrome (palette / neutral / radius / font / primary)
 * to product defaults. Only light/dark/system mode stays user-editable.
 */

export const LOCKED_THEME_CHROME = {
  palette: "open-color",
  neutral: "stone",
  radius: "0.375",
  font: "ubuntu",
} as const;

/** Spindrift primary defaults by scheme (matches VanduoVue themeDefaults). */
export function lockedPrimaryForTheme(theme: string): "black" | "amber" {
  return theme === "dark" ? "amber" : "black";
}

export type ThemePreferenceFields = {
  palette: string;
  theme: string;
  primary: string;
  neutral: string;
  radius: string;
  font: string;
};

/** Overlay locked chrome + scheme primary; preserves only `theme`. */
export function withLockedThemeChrome<T extends ThemePreferenceFields>(prefs: T): T {
  return {
    ...prefs,
    palette: LOCKED_THEME_CHROME.palette,
    neutral: LOCKED_THEME_CHROME.neutral,
    radius: LOCKED_THEME_CHROME.radius,
    font: LOCKED_THEME_CHROME.font,
    primary: lockedPrimaryForTheme(prefs.theme),
  };
}
