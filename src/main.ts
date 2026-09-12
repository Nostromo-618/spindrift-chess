import { createApp } from "vue";
import {
  VanduoVue,
  loadPreference,
  applyPreference,
  persistPreference,
  type RadiusOption,
} from "@vanduo-oss/vd3";
import App from "./App.vue";
import { withLockedThemeChrome } from "../js/utils/lockThemeDefaults.js";
import { migrateAndPurgeVanduoThemeStorage } from "../js/utils/migrateThemeStorage.js";

// vd3's full stylesheet (design tokens, component CSS, fonts, regular/fill icons).
import "@vanduo-oss/vd3/css";
// App-owned styles: token bridge, chess board, and the refreshed chrome.
import "./styles/index.css";

const app = createApp(App);

// vd3 is fully standalone (pure Vue, no window.Vanduo* runtime to bootstrap).
// Theme prefs live under the app `sdc-` namespace (not the library default `vanduo-`).
// Defaults: light → black primary, dark → amber primary, stone neutral,
// 0.375 radius, Ubuntu font, Open Color palette.
app.use(VanduoVue, {
  storagePrefix: "sdc-",
  themeDefaults: {
    PALETTE: "open-color",
    PRIMARY_LIGHT: "black",
    PRIMARY_DARK: "amber",
    NEUTRAL: "stone",
    RADIUS: "0.375",
    FONT: "ubuntu",
  },
});

// Move any legacy vanduo-* theme keys into sdc-*, then drop vanduo-* leftovers
// so localStorage is entirely app-namespaced.
migrateAndPurgeVanduoThemeStorage();

// Force locked chrome + scheme primary over any prior localStorage (returning
// users who changed primary / neutral / radius / font / palette). Theme mode
// stays user-owned. Must run before mount so useThemePreference() hydrates
// from corrected storage.
const locked = withLockedThemeChrome(loadPreference());
applyPreference({
  ...locked,
  radius: locked.radius as RadiusOption,
});
persistPreference({
  ...locked,
  radius: locked.radius as RadiusOption,
});

app.mount("#app");
