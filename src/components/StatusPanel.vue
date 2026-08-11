<script setup lang="ts">
/** Live status: current phase message, turn / last-move detail. */
import { VdChip } from "@vanduo-oss/vd3";
import { useGameStore } from "../composables/useGameStore";
import { useI18n } from "../composables/useI18n";

const store = useGameStore();
const { status } = store;
const { t } = useI18n();
</script>

<template>
  <section class="status-panel" :aria-label="t.status.label">
    <div class="status-bar" :class="{ 'is-busy': status.busy }">
      <VdChip v-if="status.busy" variant="primary" class="status-thinking">
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
