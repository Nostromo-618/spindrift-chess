<script setup lang="ts">
/**
 * Locale switcher — vd3 Mode Toggle morph (single pill, EN ↔ LT with flags).
 */
import { ref } from "vue";
import { useMorph } from "@vanduo-oss/vd3";
import { useI18n } from "../composables/useI18n";

const { locale, setLocale, t } = useI18n();
const root = ref<HTMLElement | null>(null);
useMorph(root);

/** Freeze initial current/next so Vue does not fight useMorph class swaps. */
const startEn = locale.value === "en";

function toggleLocale(): void {
  setLocale(locale.value === "en" ? "lt" : "en");
}
</script>

<template>
  <div ref="root" class="locale-morph-host">
    <button
      type="button"
      class="vd-morph locale-morph-toggle"
      data-vd-morph
      data-locale-toggle
      :aria-label="locale === 'en' ? t.header.localeSwitchLt : t.header.localeSwitchEn"
      @click="toggleLocale"
    >
      <span class="vd-morph-content" :class="startEn ? 'vd-morph-current' : 'vd-morph-next'">
        <svg class="locale-morph-flag" viewBox="0 0 60 40" aria-hidden="true">
          <rect width="60" height="40" fill="#012169" />
          <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6" />
          <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="3" />
          <path d="M0,20 L60,20 M30,0 L30,40" stroke="#fff" stroke-width="10" />
          <path d="M0,20 L60,20 M30,0 L30,40" stroke="#C8102E" stroke-width="5" />
        </svg>
        <span>EN</span>
      </span>
      <span class="vd-morph-content" :class="startEn ? 'vd-morph-next' : 'vd-morph-current'">
        <svg class="locale-morph-flag" viewBox="0 0 60 40" aria-hidden="true">
          <rect width="60" height="40" fill="#FDB913" />
          <rect y="13.33" width="60" height="13.34" fill="#006A44" />
          <rect y="26.67" width="60" height="13.33" fill="#C1272D" />
        </svg>
        <span>LT</span>
      </span>
    </button>
  </div>
</template>
