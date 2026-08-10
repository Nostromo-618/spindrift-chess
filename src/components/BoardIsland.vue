<script setup lang="ts">
/**
 * BoardIsland — the one imperative island in the app. It hands its root element
 * to the framework-agnostic `BoardView` (8x8 grid, SVG pieces, highlights,
 * promotion overlay) and bridges its callbacks to the game store. BoardView is
 * game-critical and uses no vd3, so it is kept verbatim rather than rewritten.
 */
import { onMounted, onBeforeUnmount, ref } from "vue";
import { BoardView } from "../../js/ui/BoardView.js";
import { useGameStore } from "../composables/useGameStore";

const store = useGameStore();
const container = ref<HTMLElement | null>(null);
let boardView: BoardView | null = null;

onMounted(() => {
  const el = container.value;
  if (!el) return;
  boardView = new BoardView(el, {
    onSquareSelected: (sq) => store.handleSquareSelected(sq),
    onPromotionPicked: (piece) => store.handlePromotionPicked(piece),
    onPromotionCancelled: () => store.handlePromotionCancelled(),
  });
  store.attachBoard(boardView);
});

onBeforeUnmount(() => {
  store.detachBoard();
  boardView?.hidePromotionPicker?.();
  boardView = null;
});
</script>

<template>
  <div id="board-container" ref="container" aria-label="Chess board" role="grid"></div>
</template>
