<script setup lang="ts">
/** Board column: the board island plus the desktop-only board-size slider. */
import { VdSlider } from "@vanduo-oss/vd3";
import BoardIsland from "./BoardIsland.vue";
import { useGameStore } from "../composables/useGameStore";
import { useI18n } from "../composables/useI18n";

const store = useGameStore();
const { boardSizeSlider } = store;
const { t } = useI18n();
</script>

<template>
  <section class="board-section" :aria-label="t.board.label">
    <BoardIsland />
    <div class="board-size-control-desktop">
      <label for="board-size-range" class="board-size-label">{{ t.board.size }}</label>
      <VdSlider
        id="board-size-range"
        :model-value="boardSizeSlider"
        :min="0"
        :max="100"
        @update:model-value="(v) => store.setBoardSizeSlider(Number(v))"
      />
    </div>
  </section>
</template>
