<script setup lang="ts">
/** Live status: current phase message, turn / last-move detail. */
import { VdChip } from "@vanduo-oss/vd3";
import { useGameStore } from "../composables/useGameStore";

const store = useGameStore();
const { status } = store;
</script>

<template>
  <section class="status-panel" aria-label="Game status">
    <div class="status-bar" :class="{ 'is-busy': status.busy }">
      <VdChip v-if="status.busy" variant="primary" class="status-thinking">
        <i class="ph-duotone ph-brain blinking" aria-hidden="true"></i>
        Thinking
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
