<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    selectedCount: number;
    allSelected: boolean;
    indeterminate: boolean;
    removeLabel: string;
    downloadLabel?: string;
    removing?: boolean;
    downloading?: boolean;
    downloadDisabled?: boolean;
  }>(),
  {
    removing: false,
    downloading: false,
    downloadDisabled: false,
  },
);

const emit = defineEmits<{
  toggleAll: [];
  invert: [];
  download: [];
  remove: [];
  exit: [];
}>();

const { t } = useI18n();
const busy = computed(() => props.removing || props.downloading);
</script>

<template>
  <div class="mx-5 flex h-10 items-center gap-2 text-sm text-on-surface-variant">
    <SCheckbox
      :checked="allSelected"
      :indeterminate="indeterminate"
      :disabled="busy"
      size="small"
      @update:checked="emit('toggleAll')"
    />
    <span class="tabular-nums">
      {{ t("resourceBatch.selected", { count: selectedCount }) }}
    </span>
    <SDivider vertical />
    <SButton variant="ghost" size="small" :disabled="busy" @click="emit('invert')">
      <template #icon><IconLucideArrowLeftRight class="size-3.5" /></template>
      {{ t("songList.batch.invert") }}
    </SButton>
    <SButton
      v-if="downloadLabel"
      variant="ghost"
      size="small"
      :disabled="selectedCount === 0 || busy || downloadDisabled"
      :loading="downloading"
      @click="emit('download')"
    >
      <template #icon><IconLucideDownload class="size-3.5" /></template>
      {{ downloadLabel }}
    </SButton>
    <SButton
      type="error"
      variant="ghost"
      size="small"
      :disabled="selectedCount === 0 || busy"
      :loading="removing"
      @click="emit('remove')"
    >
      <template #icon><IconLucideTrash2 class="size-3.5" /></template>
      {{ removeLabel }}
    </SButton>
    <SDivider vertical />
    <SButton variant="ghost" size="small" :disabled="busy" @click="emit('exit')">
      <template #icon><IconLucideX class="size-3.5" /></template>
      {{ t("songList.batch.exit") }}
    </SButton>
  </div>
</template>
