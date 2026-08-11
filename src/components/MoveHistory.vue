<script setup lang="ts">
/** The move log (SAN-ish entries produced by the engine snapshot). */
import { useGameStore } from "../composables/useGameStore";
import { useI18n } from "../composables/useI18n";

const { history } = useGameStore();
const { t } = useI18n();
</script>

<template>
  <section class="history-section" :aria-label="t.history.label">
    <h2 class="panel-heading">{{ t.history.title }}</h2>
    <ol id="move-history" class="move-history-list">
      <li v-for="(entry, index) in history" :key="index" :data-index="index">
        {{ entry }}
      </li>
    </ol>
    <p v-if="!history.length" class="move-history-empty">
      {{ t.history.empty }}
    </p>
  </section>
</template>
