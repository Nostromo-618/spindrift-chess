<script setup lang="ts">
/** Sticky app header: brand, live "thinking" indicator, locale switcher,
 *  and header controls (info, source, theme switcher) with a mobile offcanvas. */
import { ref } from "vue";
import { VdThemeSwitcher, VdOffcanvas } from "@vanduo-oss/vd3";
import LocaleMorphToggle from "./LocaleMorphToggle.vue";
import { useGameStore } from "../composables/useGameStore";
import { useModals } from "../composables/useModals";
import { useI18n } from "../composables/useI18n";

const { status } = useGameStore();
const { openDisclaimer } = useModals();
const { t, locale } = useI18n();

const menuOpen = ref(false);

const REPO_URL = "https://github.com/Nostromo-618/spindrift-chess";
const BRAND_ICON = `${import.meta.env.BASE_URL}brand/spindrift-rook.svg`;

function fromMenu(action: () => void): void {
  menuOpen.value = false;
  action();
}
</script>

<template>
  <header class="app-header glass-panel">
    <div class="app-header-inner">
      <h1 class="app-title">
        <img
          class="app-title-icon"
          :src="BRAND_ICON"
          width="28"
          height="28"
          alt=""
          aria-hidden="true"
        />
        <span class="app-title-text" :class="{ 'app-title-text--lt-stack': locale === 'lt' }">
          <span class="app-title-brand">Spindrift</span><span class="app-title-sep">{{ " " }}</span
          ><span class="app-title-product">{{ t.app.titleProduct }}</span>
        </span>
        <i
          class="ph-bold ph-brain thinking-icon"
          :class="{ 'thinking-icon--active blinking': status.busy }"
          aria-hidden="true"
        ></i>
      </h1>

      <div class="header-right">
        <!-- Locale: vd3 Mode Toggle morph — always in the header (mobile + desktop). -->
        <LocaleMorphToggle />

        <!-- Theme mode toggle: always visible in the header (both breakpoints). -->
        <VdThemeSwitcher id="theme-toggle-btn" :menu="false" />

        <!-- Desktop: inline controls (moved to the offcanvas on mobile). -->
        <div class="header-controls">
          <button
            id="disclaimer-info-btn"
            type="button"
            class="header-icon-btn"
            :aria-label="t.header.aboutAria"
            @click="openDisclaimer"
          >
            <i class="ph-bold ph-info" aria-hidden="true"></i>
          </button>
          <a
            id="github-repo-link"
            class="header-icon-btn"
            :href="REPO_URL"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t.header.githubAria"
          >
            <i class="ph-bold ph-github-logo" aria-hidden="true"></i>
          </a>
        </div>

        <!-- Mobile: hamburger opens the offcanvas with the desktop controls. -->
        <button
          id="mobile-menu-toggle"
          type="button"
          class="header-icon-btn mobile-menu-toggle"
          :aria-label="t.header.menuOpen"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          @click="menuOpen = true"
        >
          <i class="ph-bold ph-list" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <VdOffcanvas v-model="menuOpen" placement="right">
      <nav class="header-menu" :aria-label="t.header.menuAria">
        <button type="button" class="header-menu-item" @click="fromMenu(openDisclaimer)">
          <i class="ph-bold ph-info" aria-hidden="true"></i>
          <span>{{ t.header.about }}</span>
        </button>
        <a
          class="header-menu-item"
          :href="REPO_URL"
          target="_blank"
          rel="noopener noreferrer"
          @click="menuOpen = false"
        >
          <i class="ph-bold ph-github-logo" aria-hidden="true"></i>
          <span>{{ t.header.github }}</span>
        </a>
      </nav>
    </VdOffcanvas>
  </header>
</template>
