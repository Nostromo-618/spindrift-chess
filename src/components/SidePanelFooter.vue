<script setup lang="ts">
/** Version badge (opens the changelog) + UI attribution. */
import { version as packageVersion } from "../../package.json";
import { useModals } from "../composables/useModals";
import { useI18n } from "../composables/useI18n";

const { openChangelog } = useModals();
const { t } = useI18n();
const version = `v${packageVersion}`;
</script>

<template>
  <div class="side-panel-footer">
    <button
      id="changelog-trigger"
      type="button"
      class="app-version"
      :aria-label="t.sidePanelFooter.changelogAria({ version })"
      @click="openChangelog"
    >
      {{ version }}
    </button>
    <p class="side-panel-attribution">
      <a href="https://vd3.vanduo.dev/" target="_blank" rel="noopener noreferrer">
        {{ t.sidePanelFooter.attribution }}
      </a>
    </p>
  </div>
</template>
