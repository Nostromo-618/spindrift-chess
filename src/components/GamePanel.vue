<script setup lang="ts">
/** The right-hand control card: new game, settings, status, move history. */
import { computed } from "vue";
import { VdCard, VdButton, VdSeparator, VdSlider, VdSwitch } from "@vanduo-oss/vd3";
import SegmentedControl from "./controls/SegmentedControl.vue";
import StatusPanel from "./StatusPanel.vue";
import MoveHistory from "./MoveHistory.vue";
import SidePanelFooter from "./SidePanelFooter.vue";
import { useGameStore } from "../composables/useGameStore";
import { getEngineStrengthControlLabel } from "../../js/engineAdapter.js";
import { MIN_THINK_TIME_MS, MAX_THINK_TIME_MS } from "../../js/storage.js";
import type { ColorChoice } from "../../js/Game.js";

const store = useGameStore();
const { settings, canUndo } = store;

const colorOptions: { value: ColorChoice; label: string }[] = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "random", label: "Random" },
];

const strengthLabel = getEngineStrengthControlLabel();
const thinkTimeLabel = computed(() => `Thinking time (${settings.thinkTimeSec}s)`);
const thinkTimeMinSec = Math.round(MIN_THINK_TIME_MS / 1000);
const thinkTimeMaxSec = Math.round(MAX_THINK_TIME_MS / 1000);
</script>

<template>
  <VdCard elevated class="side-panel glass-panel">
    <div class="new-game-action">
      <VdButton
        id="new-game-btn"
        variant="primary"
        class="new-game-btn"
        :ring="true"
        @click="store.newGame()"
      >
        <i class="ph-bold ph-flag-checkered" aria-hidden="true"></i>
        New Game
      </VdButton>
      <VdButton
        id="undo-move-btn"
        variant="secondary"
        class="undo-move-btn"
        :ring="true"
        :disabled="!canUndo"
        title="Take back your last move and the computer's reply"
        @click="store.undoLastMove()"
      >
        <i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>
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

    <div id="difficulty-choice" class="strength-controls">
      <VdSlider
        v-if="!settings.uncapped"
        id="strength-slider"
        :label="strengthLabel"
        :model-value="settings.difficulty"
        :min="1"
        :max="6"
        :step="1"
        show-value
        @update:model-value="(v) => store.setDifficultyChoice(Number(v))"
      />
      <VdSwitch
        id="uncapped-switch"
        class="uncapped-switch"
        size="sm"
        label="Uncapped Spindrift strength"
        :model-value="settings.uncapped"
        @update:model-value="(v) => store.setUncapped(Boolean(v))"
      />
      <p v-if="settings.uncapped" class="settings-note">
        Thinks as deep as time allows (up to 56 ply).
      </p>
      <VdSlider
        v-if="settings.uncapped"
        id="think-time-slider"
        :label="thinkTimeLabel"
        :model-value="settings.thinkTimeSec"
        :min="thinkTimeMinSec"
        :max="thinkTimeMaxSec"
        :step="1"
        show-value
        @update:model-value="(v) => store.setThinkTimeSec(Number(v))"
      />
    </div>
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
