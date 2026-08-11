<script setup lang="ts">
/** Result dialog shown when a human game ends (checkmate / stalemate / draw). */
import { computed } from "vue";
import { VdModal, VdButton } from "@vanduo-oss/vd3";
import { useGameStore, type GameEndPayload } from "../../composables/useGameStore";
import { useI18n } from "../../composables/useI18n";

const store = useGameStore();
const { gameEndResult } = store;
const { t } = useI18n();

const open = computed({
  get: () => gameEndResult.value !== null,
  set: (v: boolean) => {
    if (!v) gameEndResult.value = null;
  },
});

interface EndView {
  icon: string;
  title: string;
  message: string;
  tone: "victory" | "defeat" | "draw";
}

const view = computed((): EndView => {
  const payload: GameEndPayload | null = gameEndResult.value;
  if (!payload) return { icon: "", title: "", message: "", tone: "draw" };
  const { result, playerColor } = payload;

  if (result.outcome === "checkmate") {
    const isPlayerWinner = result.winner === playerColor;
    const winner = result.winner === "white" ? t.value.color.white : t.value.color.black;
    return {
      icon: isPlayerWinner ? "ph-trophy" : "ph-smiley-sad",
      title: t.value.gameEnd.checkmateTitle({ winner }),
      message: t.value.gameEnd.checkmateMessage({ winner }),
      tone: isPlayerWinner ? "victory" : "defeat",
    };
  }
  if (result.outcome === "stalemate") {
    return {
      icon: "ph-handshake",
      title: t.value.gameEnd.stalemateTitle,
      message: t.value.gameEnd.stalemateMessage,
      tone: "draw",
    };
  }
  if (result.outcome === "draw") {
    return {
      icon: "ph-handshake",
      title: t.value.gameEnd.drawTitle,
      message: t.value.gameEnd.drawMessage({ reason: result.reason || "by agreement" }),
      tone: "draw",
    };
  }
  return {
    icon: "ph-flag",
    title: t.value.gameEnd.gameOverTitle,
    message: result.reason || t.value.gameEnd.gameOverMessage,
    tone: "draw",
  };
});

function newGame(): void {
  gameEndResult.value = null;
  void store.newGame();
}
</script>

<template>
  <VdModal v-model:open="open" size="sm" :title="view.title">
    <div id="game-end-modal" class="game-end-body" :class="`game-end-tone-${view.tone}`">
      <i class="game-end-icon ph-bold" :class="view.icon" aria-hidden="true"></i>
      <p class="game-end-message">{{ view.message }}</p>
    </div>
    <template #footer>
      <VdButton id="game-end-new-game-btn" variant="primary" @click="newGame">
        <i class="ph-bold ph-flag-checkered" aria-hidden="true"></i>
        {{ t.gameEnd.newGame }}
      </VdButton>
      <VdButton id="game-end-close-btn" variant="ghost" @click="open = false">
        {{ t.gameEnd.close }}
      </VdButton>
    </template>
  </VdModal>
</template>
