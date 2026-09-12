<script setup lang="ts">
/** Live status: current phase message, turn / last-move detail. */
import { computed } from "vue";
import { VdChip } from "@vanduo-oss/vd3";
import { useGameStore } from "../composables/useGameStore";
import { useI18n } from "../composables/useI18n";

const store = useGameStore();
const { status, settings } = store;
const { t } = useI18n();

/** Detailed thinking (chip + metrics) is uncapped-only; navbar brain covers 1–6. */
const showThinkingDetails = computed(() => status.busy && settings.uncapped);
</script>

<template>
  <section class="status-panel" :aria-label="t.status.label">
    <div class="status-bar status-bar--panel" :class="{ 'is-busy': showThinkingDetails }">
      <VdChip v-if="showThinkingDetails" variant="primary" class="status-thinking">
        <i class="ph-bold ph-brain blinking" aria-hidden="true"></i>
        {{ t.status.thinking }}
      </VdChip>
      <div id="status-text" class="status-text" role="status" aria-live="polite">
        {{ status.text }}
      </div>
    </div>

    <div class="status-detail">
      <div id="turn-indicator" class="status-sub">{{ status.turn }}</div>
      <div id="last-move-indicator" class="status-sub">{{ status.lastMove }}</div>
    </div>
  </section>
</template>
