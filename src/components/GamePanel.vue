<script setup lang="ts">
/** The right-hand control card: new game, settings, status, move history. */
import { VdCard, VdButton, VdSeparator } from "@vanduo-oss/vd3";
import SegmentedControl from "./controls/SegmentedControl.vue";
import StatusPanel from "./StatusPanel.vue";
import MoveHistory from "./MoveHistory.vue";
import SidePanelFooter from "./SidePanelFooter.vue";
import { useGameStore } from "../composables/useGameStore";
import type { ColorChoice } from "../../js/Game.js";

const store = useGameStore();
const { settings, canUndo } = store;

const colorOptions: { value: ColorChoice; label: string }[] = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "random", label: "Random" },
];
const levelOptions: { value: number; label: string; title: string }[] = [
  { value: 1, label: "1", title: "Very Easy" },
  { value: 2, label: "2", title: "Easy" },
  { value: 3, label: "3", title: "Medium" },
  { value: 4, label: "4", title: "Hard" },
  { value: 5, label: "5", title: "Very Hard" },
  { value: 6, label: "6", title: "Expert" },
];
</script>

<template>
  <VdCard elevated class="side-panel glass-panel">
    <div class="new-game-action">
      <VdButton id="new-game-btn" variant="primary" class="new-game-btn" @click="store.newGame()">
        <i class="ph-duotone ph-flag-checkered" aria-hidden="true"></i>
        New Game
      </VdButton>
      <VdButton
        id="undo-move-btn"
        variant="secondary"
        class="undo-move-btn"
        :disabled="!canUndo"
        title="Take back your last move and the computer's reply"
        @click="store.undoLastMove()"
      >
        <i class="ph-duotone ph-arrow-counter-clockwise" aria-hidden="true"></i>
        Undo
      </VdButton>
    </div>

    <h2 class="panel-heading">Game Settings</h2>

    <SegmentedControl
      id="color-choice"
      label="Play as"
      data-key="color"
      :options="colorOptions"
      :model-value="settings.color"
      @update:model-value="(v) => store.setColor(v as ColorChoice)"
    />
    <SegmentedControl
      id="difficulty-choice"
      label="Computer strength"
      data-key="level"
      :options="levelOptions"
      :model-value="settings.difficulty"
      @update:model-value="(v) => store.setDifficultyChoice(Number(v))"
    />
    <p class="settings-note">
      Strength changes apply to your current game; color takes effect on your next New Game.
    </p>

    <VdSeparator />

    <StatusPanel />

    <VdSeparator />

    <MoveHistory />

    <SidePanelFooter />
  </VdCard>
</template>
