<script setup lang="ts">
/**
 * AppThemeCustomizer — translated replacement for vd3's `VdThemeCustomizer`.
 *
 * vd3's compiled customizer hardcodes English labels with no i18n API, so the
 * panel is re-implemented here against vd3's exported theme singleton
 * (`useThemePreference`) and option lists, reusing the library's `tc-*` classes
 * so styling, the `body > .vd-theme-customizer-panel` anchor rules, and the
 * `vd:open-customizer` event contract stay identical.
 */
import { onMounted, onBeforeUnmount, ref } from "vue";
import {
  useThemePreference,
  useClickOutside,
  PRIMARY_COLORS,
  NEUTRAL_COLORS,
  RADIUS_OPTIONS,
  FONT_OPTIONS,
  type RadiusOption,
} from "@vanduo-oss/vd3";
import { useI18n } from "../composables/useI18n";

const theme = useThemePreference();
const { t } = useI18n();

function colorName(key: string): string {
  return t.value.theme.colorNames[key] ?? key;
}

function fontName(key: string): string {
  return t.value.theme.fontNames[key] ?? key;
}

const open = ref(false);
const panelRef = ref<HTMLElement | null>(null);

// Closing authority: outside clicks (desktop dropdown), Escape, mobile close.
// vd3's overlay backdrop alone is unreliable on desktop (static, zero-height),
// so click-outside is driven by the same composable the library component uses.
useClickOutside([panelRef], closePanel, open);

function openPanel(): void {
  open.value = true;
}

function closePanel(): void {
  open.value = false;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape" && open.value) closePanel();
}

function onOpenCustomizer(): void {
  openPanel();
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("vd:open-customizer", onOpenCustomizer);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("vd:open-customizer", onOpenCustomizer);
});
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <div class="vd-theme-customizer-overlay is-active" @click="closePanel"></div>
      <aside
        ref="panelRef"
        class="vd-theme-customizer-panel is-open"
        role="dialog"
        :aria-label="t.theme.customize"
      >
        <div class="tc-header">
          <h3 class="tc-title">{{ t.theme.customize }}</h3>
          <button
            type="button"
            class="customizer-mobile-close"
            :aria-label="t.theme.close"
            @click="closePanel"
          >
            <i class="ph-bold ph-x" aria-hidden="true"></i>
          </button>
        </div>

        <div class="tc-body">
          <div class="tc-section">
            <label class="tc-label">{{ t.theme.primary }}</label>
            <div class="tc-color-grid">
              <button
                v-for="c in PRIMARY_COLORS"
                :key="c.key"
                type="button"
                class="tc-color-swatch"
                :class="{ 'is-active': theme.state.primary === c.key }"
                :style="{ '--vd-swatch-color': c.color }"
                :title="colorName(c.key)"
                :aria-label="colorName(c.key)"
                @click="theme.setPrimary(c.key)"
              ></button>
            </div>
          </div>

          <div class="tc-section">
            <label class="tc-label">{{ t.theme.neutral }}</label>
            <div class="tc-neutral-grid">
              <button
                v-for="c in NEUTRAL_COLORS"
                :key="c.key"
                type="button"
                class="tc-neutral-swatch"
                :class="{ 'is-active': theme.state.neutral === c.key }"
                :style="{ '--vd-swatch-color': c.color }"
                :title="colorName(c.key)"
                @click="theme.setNeutral(c.key)"
              >
                <span>{{ colorName(c.key) }}</span>
              </button>
            </div>
          </div>

          <div class="tc-section">
            <label class="tc-label">{{ t.theme.radius }}</label>
            <div class="tc-radius-group">
              <button
                v-for="r in RADIUS_OPTIONS"
                :key="r"
                type="button"
                class="tc-radius-btn"
                :class="{ 'is-active': theme.state.radius === r }"
                @click="theme.setRadius(r as RadiusOption)"
              >
                {{ r }}
              </button>
            </div>
          </div>

          <div class="tc-section">
            <label class="tc-label" for="app-theme-font">{{ t.theme.font }}</label>
            <select
              id="app-theme-font"
              class="tc-font-select"
              :value="theme.state.font"
              @change="(e) => theme.setFont((e.target as HTMLSelectElement).value)"
            >
              <option v-for="f in FONT_OPTIONS" :key="f.key" :value="f.key">
                {{ fontName(f.key) }}
              </option>
            </select>
          </div>
        </div>

        <div class="tc-footer">
          <button type="button" class="customizer-reset" @click="theme.reset()">
            <i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>
            {{ t.theme.reset }}
          </button>
        </div>
      </aside>
    </template>
  </Teleport>
</template>
