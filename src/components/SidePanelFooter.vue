<script setup lang="ts">
/** Version badge (opens the changelog) + UI attribution. */
import { useModals } from "../composables/useModals";

const { openChangelog } = useModals();
const version = `v${__APP_VERSION__}`;
</script>

<template>
  <div class="side-panel-footer">
    <button
      id="changelog-trigger"
      type="button"
      class="app-version"
      :aria-label="`Open changelog for version ${version}`"
      @click="openChangelog"
    >
      {{ version }}
    </button>
    <p class="side-panel-attribution">
      <a href="https://vd3.vanduo.dev/" target="_blank" rel="noopener noreferrer"> UI by vd3 </a>
    </p>
  </div>
</template>
