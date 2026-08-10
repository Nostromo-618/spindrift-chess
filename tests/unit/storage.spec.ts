import { beforeEach, describe, expect, it } from "vitest";
import {
  clearGame,
  getBoardSize,
  getColorChoice,
  getDifficulty,
  getDisclaimerAccepted,
  getGame,
  getTheme,
  getUncapped,
  getThinkTimeMs,
  setBoardSize,
  setColorChoice,
  setDifficulty,
  setDisclaimerAccepted,
  setGame,
  setTheme,
  setUncapped,
  setThinkTimeMs,
  DEFAULT_THINK_TIME_MS,
  MIN_THINK_TIME_MS,
  MAX_THINK_TIME_MS,
} from "../../js/storage.js";
import { installMemoryLocalStorage } from "../utils/test-utils.js";
import type { ThemePreference } from "../../js/storage.js";

describe("Storage", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  describe("Disclaimer", () => {
    it("defaults false and round-trips after accept", () => {
      expect(getDisclaimerAccepted()).toBe(false);
      setDisclaimerAccepted();
      expect(getDisclaimerAccepted()).toBe(true);
      expect(localStorage.getItem("sdc-disclaimer-accepted")).toBe("true");
    });
  });

  describe("Theme", () => {
    it("defaults to system and round-trips valid values", () => {
      expect(getTheme()).toBe("system");
      for (const theme of ["light", "dark", "system"] as ThemePreference[]) {
        setTheme(theme);
        expect(getTheme()).toBe(theme);
      }
      setTheme("invalid" as ThemePreference);
      expect(getTheme()).toBe("system");
    });

    it("rejects corrupt stored theme and syncs vanduo key", () => {
      localStorage.setItem("sdc-theme", "neon");
      expect(getTheme()).toBe("system");
      setTheme("dark");
      expect(localStorage.getItem("vanduo-theme-preference")).toBe("dark");
    });
  });

  describe("Color Choice", () => {
    it("round-trips valid colors and ignores invalid", () => {
      expect(getColorChoice()).toBeNull();
      for (const color of ["white", "black", "random"] as const) {
        setColorChoice(color);
        expect(getColorChoice()).toBe(color);
      }
      setColorChoice("purple" as "white");
      expect(getColorChoice()).toBe("random");
    });
  });

  describe("Difficulty", () => {
    it("round-trips levels 1–6 and clamps", () => {
      expect(getDifficulty()).toBeNull();
      for (const level of [1, 2, 3, 4, 5, 6]) {
        setDifficulty(level);
        expect(getDifficulty()).toBe(level);
      }
      setDifficulty(0);
      expect(getDifficulty()).toBe(6);
      setDifficulty(999);
      expect(getDifficulty()).toBe(6);
      setDifficulty(Number.NaN);
      expect(getDifficulty()).toBe(6);
    });

    it("returns null for corrupt stored values", () => {
      localStorage.setItem("sdc-difficulty", "abc");
      expect(getDifficulty()).toBeNull();
      localStorage.setItem("sdc-difficulty", "999");
      expect(getDifficulty()).toBeNull();
    });
  });

  describe("Uncapped / think time", () => {
    it("round-trips uncapped flag", () => {
      expect(getUncapped()).toBe(false);
      setUncapped(true);
      expect(getUncapped()).toBe(true);
      expect(localStorage.getItem("sdc-uncapped")).toBe("true");
      setUncapped(false);
      expect(getUncapped()).toBe(false);
    });

    it("round-trips and clamps think time", () => {
      expect(getThinkTimeMs()).toBeNull();
      setThinkTimeMs(DEFAULT_THINK_TIME_MS);
      expect(getThinkTimeMs()).toBe(DEFAULT_THINK_TIME_MS);
      setThinkTimeMs(500);
      expect(getThinkTimeMs()).toBe(MIN_THINK_TIME_MS);
      setThinkTimeMs(99_000);
      expect(getThinkTimeMs()).toBe(MAX_THINK_TIME_MS);
      localStorage.setItem("sdc-think-time-ms", "nope");
      expect(getThinkTimeMs()).toBeNull();
    });
  });

  describe("Game", () => {
    it("round-trips and validates payloads", () => {
      expect(getGame()).toBeNull();
      const state = { board: new Array(64).fill(null), activeColor: "white", moveHistory: [] };
      setGame(state);
      expect(getGame()).toMatchObject({ activeColor: "white" });

      localStorage.setItem("sdc-game", "not json");
      expect(getGame()).toBeNull();
      localStorage.setItem("sdc-game", JSON.stringify({ activeColor: "white" }));
      expect(getGame()).toBeNull();
      localStorage.setItem("sdc-game", JSON.stringify({ board: [] }));
      expect(getGame()).toBeNull();

      setGame(state);
      clearGame();
      expect(getGame()).toBeNull();

      setGame(null);
      expect(localStorage.getItem("sdc-game")).toBeNull();
    });
  });

  describe("Board Size", () => {
    it("round-trips and clamps", () => {
      expect(getBoardSize()).toBeNull();
      setBoardSize(75);
      expect(getBoardSize()).toBe(75);
      setBoardSize(-10);
      expect(getBoardSize()).toBe(0);
      setBoardSize(200);
      expect(getBoardSize()).toBe(100);
      localStorage.setItem("sdc-board-size", "big");
      expect(getBoardSize()).toBeNull();
      localStorage.setItem("sdc-board-size", "50.7");
      expect(getBoardSize()).toBe(51);
    });
  });
});
