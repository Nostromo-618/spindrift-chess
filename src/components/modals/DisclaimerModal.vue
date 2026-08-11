<script setup lang="ts">
/**
 * First-visit disclaimer / consent gate. Mandatory: the only close path is
 * "Accept & Play" (which records acceptance). Backdrop / Escape / the built-in
 * close button are suppressed — vd3's VdModal has no `persistent` mode yet, so
 * we neutralize its dismiss emits and hide its close button via CSS.
 * (Logged as vd3 dogfooding feedback: VdModal could use a `dismissible` prop.)
 */
import { setDisclaimerAccepted } from "../../../js/storage.js";
import { VdModal, VdButton } from "@vanduo-oss/vd3";
import { useModals } from "../../composables/useModals";
import { useI18n } from "../../composables/useI18n";

const { disclaimerOpen, closeDisclaimer } = useModals();
const { t } = useI18n();

/** Same brand mark as the navbar (`AppHeader`). */
const BRAND_ICON = `${import.meta.env.BASE_URL}brand/spindrift-rook.svg`;

function accept(): void {
  setDisclaimerAccepted();
  closeDisclaimer();
}
</script>

<template>
  <VdModal :open="disclaimerOpen" :close-on-backdrop="false" @update:open="() => {}">
    <template #header>
      <div class="disclaimer-modal-heading">
        <span class="disclaimer-modal-icon">
          <img
            class="disclaimer-modal-icon-img"
            :src="BRAND_ICON"
            width="56"
            height="56"
            alt=""
            aria-hidden="true"
          />
        </span>
        <h2 id="disclaimer-modal-title" class="disclaimer-modal-title">
          {{ t.disclaimer.title }}
        </h2>
      </div>
    </template>

    <div id="disclaimer-modal" class="disclaimer-scope">
      <p class="disclaimer-intro">
        {{ t.disclaimer.intro }}
      </p>

      <ul class="disclaimer-list">
        <li>
          <i class="ph-bold ph-info" aria-hidden="true"></i>
          <div class="disclaimer-li-body">
            <strong>{{ t.disclaimer.entertainmentTitle }}</strong>
            {{ t.disclaimer.entertainmentBody }}
          </div>
        </li>
        <li>
          <i class="ph-bold ph-database" aria-hidden="true"></i>
          <div class="disclaimer-li-body">
            <strong>{{ t.disclaimer.storageTitle }}</strong>
            {{ t.disclaimer.storageBody }}
          </div>
        </li>
        <li>
          <i class="ph-bold ph-code" aria-hidden="true"></i>
          <div class="disclaimer-li-body">
            <strong>{{ t.disclaimer.opensourceTitle }}</strong>
            {{ t.disclaimer.opensourceBody }}
          </div>
        </li>
        <li>
          <i class="ph-bold ph-horse" aria-hidden="true"></i>
          <div class="disclaimer-li-body">
            <strong>{{ t.disclaimer.artworkTitle }}</strong>
            {{ t.disclaimer.artworkBody }}
            <a
              href="https://github.com/Nostromo-618/spindrift-chess/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              class="disclaimer-inline-link"
              >MIT License</a
            >.
          </div>
        </li>
        <li>
          <i class="ph-bold ph-star" aria-hidden="true"></i>
          <div class="disclaimer-li-body">
            <strong>{{ t.disclaimer.supportTitle }}</strong>
            {{ t.disclaimer.supportBody }}
            <a
              href="https://github.com/Nostromo-618/spindrift-chess"
              target="_blank"
              rel="noopener noreferrer"
              class="disclaimer-inline-link"
              >github.com/Nostromo-618/spindrift-chess</a
            >.
          </div>
        </li>
      </ul>

      <p class="disclaimer-footnote">
        {{ t.disclaimer.footnote }}
      </p>
    </div>

    <template #footer>
      <VdButton
        id="disclaimer-accept-btn"
        variant="primary"
        size="lg"
        class="disclaimer-accept-btn"
        @click="accept"
      >
        <i class="ph-bold ph-check-circle" aria-hidden="true"></i>
        {{ t.disclaimer.accept }}
      </VdButton>
    </template>
  </VdModal>
</template>
