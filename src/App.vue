<script setup lang="ts">
/** App shell: header, board + control panel, dialogs, theme customizer. */
import { onMounted, watch } from "vue";
import { useThemePreference, VdToastContainer } from "@vanduo-oss/vd3";
import AppHeader from "./components/AppHeader.vue";
import BoardPanel from "./components/BoardPanel.vue";
import GamePanel from "./components/GamePanel.vue";
import GameEndModal from "./components/modals/GameEndModal.vue";
import NewGameConfirmModal from "./components/modals/NewGameConfirmModal.vue";
import DisclaimerModal from "./components/modals/DisclaimerModal.vue";
import ChangelogModal from "./components/modals/ChangelogModal.vue";
import AppThemeCustomizer from "./components/AppThemeCustomizer.vue";
import { useGameStore } from "./composables/useGameStore";
import { useModals } from "./composables/useModals";
import { useI18n } from "./composables/useI18n";

// Apply the persisted theme on mount (sets data-primary / data-theme on <html>).
useThemePreference();

const store = useGameStore();
const modals = useModals();
const { t, locale } = useI18n();

onMounted(async () => {
  await store.restore();
  // First visit: gate on the disclaimer.
  if (!store.getDisclaimerAccepted()) modals.openDisclaimer();
});

watch(locale, () => {
  store.resyncStatus();
});
</script>

<template>
  <div id="app-root">
    <AppHeader />

    <main class="app-main">
      <div class="app-layout">
        <BoardPanel />
        <aside class="app-aside" :aria-label="t.board.controls">
          <GamePanel />
        </aside>
      </div>
    </main>

    <GameEndModal />
    <NewGameConfirmModal />
    <DisclaimerModal />
    <ChangelogModal />
    <VdToastContainer />
    <!-- Spindrift Chess sticks to the Open Color palette, so the palette
         selector (Open Color / Fibonacci) is hidden. -->
    <AppThemeCustomizer />
  </div>
</template>
