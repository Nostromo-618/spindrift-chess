<script setup lang="ts">
/**
 * A single-select segmented control built on vd3's button-group + button CSS
 * (vd3 has no dedicated segmented component). Reactive active state replaces the
 * old imperative `vd-is-active` toggling in Controls.js / main.js, while keeping
 * the same DOM shape (container id + `data-*` buttons) so the game's Playwright
 * selectors keep working.
 */
import { computed } from "vue";

export interface SegmentedOption {
  value: string | number;
  label: string;
  title?: string;
  tooltip?: string;
}

const props = withDefaults(
  defineProps<{
    /** Container id (e.g. "difficulty-choice") — preserved for tests. */
    id?: string;
    /** Explicit id for the label element (defaults to `${id}-label`). */
    labelId?: string;
    /** Visible group label; omit for an unlabeled group. */
    label?: string;
    /** Accessible name for the group (falls back to `label`). */
    ariaLabel?: string;
    /** data-* attribute key carrying each option value (color|level|…). */
    dataKey: string;
    options: SegmentedOption[];
    modelValue?: string | number | null;
    size?: string;
    /** When true, the control is locked (e.g. a setting that can't change mid-game). */
    disabled?: boolean;
    /** Native tooltip shown on the (non-disabled) group wrapper while locked. */
    disabledHint?: string;
    /** Extra class(es) for the visible label (e.g. panel-heading). */
    labelClass?: string;
  }>(),
  {
    id: "",
    labelId: "",
    label: "",
    ariaLabel: "",
    modelValue: null,
    size: "sm",
    disabled: false,
    disabledHint: "",
    labelClass: "",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const resolvedLabelId = computed(() => {
  if (props.labelId) return props.labelId;
  if (props.id) return `${props.id}-label`;
  return undefined;
});

function select(value: string | number): void {
  if (props.disabled) return;
  emit("update:modelValue", value);
}
</script>

<template>
  <div
    class="settings-group"
    :class="{ 'is-locked': disabled }"
    :title="disabled && disabledHint ? disabledHint : undefined"
  >
    <div v-if="label" :id="resolvedLabelId" class="settings-label" :class="labelClass || undefined">
      {{ label }}
      <i v-if="disabled" class="ph-bold ph-lock-simple settings-lock" aria-hidden="true"></i>
    </div>
    <div
      :id="id"
      class="vd-btn-group segmented"
      role="group"
      :aria-label="ariaLabel || label || undefined"
      :aria-labelledby="label ? resolvedLabelId : undefined"
      :aria-disabled="disabled ? 'true' : undefined"
    >
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        type="button"
        class="vd-btn vd-btn-outline"
        :class="[`vd-btn-${size}`, { 'vd-is-active': modelValue === opt.value }]"
        :[`data-${dataKey}`]="opt.value"
        :title="opt.title || undefined"
        :disabled="disabled"
        :aria-pressed="modelValue === opt.value ? 'true' : 'false'"
        :data-tooltip="opt.tooltip || undefined"
        @click="select(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
