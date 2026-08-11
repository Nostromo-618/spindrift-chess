import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const APP_VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
).version as string;

// Production is https://spindriftchess.online (Cloudflare Pages) at site root.
// Override with VITE_BASE only for rare non-root deploys.
const BASE = process.env.VITE_BASE ?? "/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE : "/",
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["vue"],
  },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("../../0_vanduo/vd3", import.meta.url)),
      ],
    },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
  },
}));
