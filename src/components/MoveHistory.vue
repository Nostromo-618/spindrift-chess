<script setup lang="ts">
/** The move log (SAN-ish entries produced by the engine snapshot). */
import { computed, ref } from "vue";
import { VdSwitch, useTooltips } from "@vanduo-oss/vd3";
import { useGameStore } from "../composables/useGameStore";
import { useI18n } from "../composables/useI18n";

const { history } = useGameStore();
const { t } = useI18n();

/** Newest-first (dsc) by default; session-only — not persisted. */
const newestFirst = ref(true);

/** Host for vd3 `[data-tooltip]` hover wiring (placement below the switch). */
const historyRoot = ref<HTMLElement | null>(null);
useTooltips(historyRoot);

const orderedMoves = computed(() => {
  const numbered = history.value.map((text, i) => ({ text, n: i + 1, index: i }));
  return newestFirst.value ? [...numbered].reverse() : numbered;
});
</script>

<template>
  <section ref="historyRoot" class="history-section" :aria-label="t.history.label">
    <div class="history-heading-row">
      <h2 class="panel-heading">{{ t.history.title }}</h2>
      <span
        class="history-sort-tip"
        :data-tooltip="newestFirst ? t.history.sortTooltipDsc : t.history.sortTooltipAsc"
        data-tooltip-placement="bottom"
      >
        <VdSwitch
          id="history-sort-switch"
          class="history-sort-switch"
          size="sm"
          :label="newestFirst ? t.history.sortDsc : t.history.sortAsc"
          :aria-label="t.history.sortAria"
          :model-value="newestFirst"
          @update:model-value="(v) => (newestFirst = Boolean(v))"
        />
      </span>
    </div>
    <ol id="move-history" class="move-history-list">
      <li v-for="entry in orderedMoves" :key="entry.index" :data-index="entry.index">
        {{ entry.n }}. {{ entry.text }}
      </li>
    </ol>
    <p v-if="!history.length" class="move-history-empty">
      {{ t.history.empty }}
    </p>
  </section>
</template>
