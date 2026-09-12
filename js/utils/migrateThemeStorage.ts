/**
 * One-shot migrate of vd3 theme keys from the default `vanduo-` prefix to
 * Spindrift's `sdc-` namespace, then purge any remaining `vanduo-*` keys.
 */

export const THEME_STORAGE_SUFFIXES = [
  "palette",
  "primary-color",
  "neutral-color",
  "radius",
  "theme-preference",
  "font-preference",
] as const;

const LEGACY_PREFIX = "vanduo-";
const APP_PREFIX = "sdc-";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** Copy each theme key from vanduo-* → sdc-* when the sdc key is missing. */
export function migrateVanduoThemeKeysToSdc(store: StorageLike = localStorage): void {
  for (const suffix of THEME_STORAGE_SUFFIXES) {
    const legacyKey = `${LEGACY_PREFIX}${suffix}`;
    const nextKey = `${APP_PREFIX}${suffix}`;
    const legacy = store.getItem(legacyKey);
    if (legacy !== null && store.getItem(nextKey) === null) {
      store.setItem(nextKey, legacy);
    }
  }
}

/** Remove every localStorage key that starts with `vanduo-`. */
export function purgeVanduoStorageKeys(store: StorageLike = localStorage): void {
  const toRemove: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(LEGACY_PREFIX)) toRemove.push(key);
  }
  for (const key of toRemove) store.removeItem(key);
}

/** Migrate theme prefs then drop all vanduo-* leftovers. */
export function migrateAndPurgeVanduoThemeStorage(store: StorageLike = localStorage): void {
  migrateVanduoThemeKeysToSdc(store);
  purgeVanduoStorageKeys(store);
}
