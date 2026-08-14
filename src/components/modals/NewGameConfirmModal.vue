<script setup lang="ts">
/** Confirms New Game when the current game already has moves. */
import { computed } from "vue";
import { VdModal, VdButton } from "@vanduo-oss/vd3";
import { useGameStore } from "../../composables/useGameStore";
import { useModals } from "../../composables/useModals";
import { useI18n } from "../../composables/useI18n";

const store = useGameStore();
const { newGameConfirmOpen } = useModals();
const { t } = useI18n();

const open = computed({
  get: () => newGameConfirmOpen.value,
  set: (v: boolean) => {
    newGameConfirmOpen.value = v;
  },
});

function confirm(): void {
  newGameConfirmOpen.value = false;
  void store.newGame();
}
</script>

<template>
  <VdModal v-model:open="open" size="sm" :title="t.newGameConfirm.title">
    <div id="new-game-confirm-modal" class="new-game-confirm-body">
      <i class="new-game-confirm-icon ph-bold ph-warning" aria-hidden="true"></i>
      <p class="new-game-confirm-message">{{ t.newGameConfirm.message }}</p>
    </div>
    <template #footer>
      <VdButton id="new-game-confirm-btn" variant="danger" @click="confirm">
        <i class="ph-bold ph-flag-checkered" aria-hidden="true"></i>
        {{ t.newGameConfirm.confirm }}
      </VdButton>
      <VdButton id="new-game-cancel-btn" variant="ghost" @click="open = false">
        {{ t.newGameConfirm.cancel }}
      </VdButton>
    </template>
  </VdModal>
</template>
