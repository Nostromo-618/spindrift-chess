<script setup lang="ts">
/**
 * LocaleSwitcher — segmented EN/LT control with inline SVG flags and a sliding
 * thumb that expands slightly left of the active segment.
 */
import { computed } from "vue";
import { useI18n, type Locale } from "../composables/useI18n";

const { locale, setLocale, t } = useI18n();

interface Option {
  value: Locale;
  code: string;
  ariaLabel: string;
}

const options = computed<Option[]>(() => [
  { value: "en", code: "EN", ariaLabel: t.value.header.localeSwitchEn },
  { value: "lt", code: "LT", ariaLabel: t.value.header.localeSwitchLt },
]);

const emit = defineEmits<{ select: [locale: Locale] }>();

function pick(value: Locale): void {
  setLocale(value);
  emit("select", value);
}
</script>

<template>
  <div class="locale-switcher" role="group" :aria-label="t.header.localeGroup">
    <span
      class="locale-switcher-thumb"
      :class="{ 'is-lt': locale === 'lt' }"
      aria-hidden="true"
    ></span>

    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="locale-switcher-option"
      :class="{ active: locale === opt.value }"
      :aria-label="opt.ariaLabel"
      :aria-pressed="locale === opt.value"
      @click="pick(opt.value)"
    >
      <!-- EN – Union Jack -->
      <svg
        v-if="opt.value === 'en'"
        class="locale-switcher-flag"
        viewBox="0 0 60 40"
        aria-hidden="true"
      >
        <rect width="60" height="40" fill="#012169" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="3" />
        <path d="M0,20 L60,20 M30,0 L30,40" stroke="#fff" stroke-width="10" />
        <path d="M0,20 L60,20 M30,0 L30,40" stroke="#C8102E" stroke-width="5" />
      </svg>

      <!-- LT – Lithuanian tricolour -->
      <svg v-else class="locale-switcher-flag" viewBox="0 0 60 40" aria-hidden="true">
        <rect width="60" height="40" fill="#FDB913" />
        <rect y="13.33" width="60" height="13.34" fill="#006A44" />
        <rect y="26.67" width="60" height="13.33" fill="#C1272D" />
      </svg>

      <span class="locale-switcher-code">{{ opt.code }}</span>
    </button>
  </div>
</template>
