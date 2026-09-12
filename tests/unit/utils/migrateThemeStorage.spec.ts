import { describe, it, expect, beforeEach } from "vitest";
import {
  migrateAndPurgeVanduoThemeStorage,
  migrateVanduoThemeKeysToSdc,
  purgeVanduoStorageKeys,
} from "../../../js/utils/migrateThemeStorage.js";
import { installMemoryLocalStorage } from "../../utils/test-utils.js";

describe("migrateThemeStorage", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it("copies vanduo theme keys to sdc when sdc is missing", () => {
    localStorage.setItem("vanduo-theme-preference", "dark");
    localStorage.setItem("vanduo-palette", "fibonacci");
    localStorage.setItem("sdc-radius", "0.375");
    localStorage.setItem("vanduo-radius", "0.5");

    migrateVanduoThemeKeysToSdc();

    expect(localStorage.getItem("sdc-theme-preference")).toBe("dark");
    expect(localStorage.getItem("sdc-palette")).toBe("fibonacci");
    // Existing sdc value wins.
    expect(localStorage.getItem("sdc-radius")).toBe("0.375");
  });

  it("purges all vanduo- keys", () => {
    localStorage.setItem("vanduo-theme-preference", "light");
    localStorage.setItem("vanduo-primary-color", "violet");
    localStorage.setItem("sdc-disclaimer-accepted", "true");

    purgeVanduoStorageKeys();

    expect(localStorage.getItem("vanduo-theme-preference")).toBeNull();
    expect(localStorage.getItem("vanduo-primary-color")).toBeNull();
    expect(localStorage.getItem("sdc-disclaimer-accepted")).toBe("true");
  });

  it("migrateAndPurge leaves only sdc theme keys from legacy data", () => {
    localStorage.setItem("vanduo-theme-preference", "light");
    localStorage.setItem("vanduo-primary-color", "teal");
    localStorage.setItem("sdc-board-size", "100");

    migrateAndPurgeVanduoThemeStorage();

    expect(localStorage.getItem("sdc-theme-preference")).toBe("light");
    expect(localStorage.getItem("sdc-primary-color")).toBe("teal");
    expect(localStorage.getItem("vanduo-theme-preference")).toBeNull();
    expect(localStorage.getItem("sdc-board-size")).toBe("100");
  });
});
