import { ref, type Ref } from "vue";

/**
 * Tiny shared UI-state singleton for the app's dialogs. The game-end dialog is
 * driven by the game store (`gameEndResult`); the disclaimer, changelog, and
 * new-game confirm are opened from chrome and gated here.
 */
const disclaimerOpen = ref(false);
const changelogOpen = ref(false);
const newGameConfirmOpen = ref(false);

export interface ModalsApi {
  disclaimerOpen: Ref<boolean>;
  changelogOpen: Ref<boolean>;
  newGameConfirmOpen: Ref<boolean>;
  openDisclaimer: () => boolean;
  closeDisclaimer: () => boolean;
  openChangelog: () => boolean;
  closeChangelog: () => boolean;
  openNewGameConfirm: () => boolean;
  closeNewGameConfirm: () => boolean;
}

export function useModals(): ModalsApi {
  return {
    disclaimerOpen,
    changelogOpen,
    newGameConfirmOpen,
    openDisclaimer: () => (disclaimerOpen.value = true),
    closeDisclaimer: () => (disclaimerOpen.value = false),
    openChangelog: () => (changelogOpen.value = true),
    closeChangelog: () => (changelogOpen.value = false),
    openNewGameConfirm: () => (newGameConfirmOpen.value = true),
    closeNewGameConfirm: () => (newGameConfirmOpen.value = false),
  };
}
