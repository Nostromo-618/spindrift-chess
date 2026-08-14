import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Production is https://spindriftchess.online (Cloudflare Pages) at site root.
// Override with VITE_BASE only for rare non-root deploys.
const BASE = process.env.VITE_BASE ?? "/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE : "/",
  plugins: [vue()],
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
