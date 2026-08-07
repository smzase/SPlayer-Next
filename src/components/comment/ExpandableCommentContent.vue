<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    contentKey?: string;
    maxLines?: number;
    lineHeight?: number;
    compact?: boolean;
  }>(),
  {
    contentKey: "",
    maxLines: 10,
    lineHeight: 24,
    compact: false,
  },
);

const emit = defineEmits<{
  collapse: [];
}>();

const { t } = useI18n();
const contentRef = shallowRef<HTMLElement | null>(null);
const expanded = ref(false);
const measured = ref(false);
const naturalHeight = ref(0);
const expandable = ref(false);

const collapsedHeight = computed(() => props.maxLines * props.lineHeight);
const clipMaxHeight = computed(() => {
  if (!measured.value) return collapsedHeight.value + "px";
  if (!expandable.value) return naturalHeight.value + "px";
  return (expanded.value ? naturalHeight.value : collapsedHeight.value) + "px";
});

/** 根据完整内容高度判断是否超过限定行数 */
const measure = (): void => {
  const element = contentRef.value;
  if (!element) return;
  naturalHeight.value = element.scrollHeight;
  expandable.value = naturalHeight.value > collapsedHeight.value + 1;
  measured.value = true;
};

useResizeObserver(contentRef, measure);

/** 切换展开状态，并在收起时通知外层恢复阅读位置 */
const toggleExpanded = (): void => {
  const collapsing = expanded.value;
  expanded.value = !expanded.value;
  if (collapsing) emit("collapse");
};

watch(
  () => [props.contentKey, props.maxLines, props.lineHeight] as const,
  async () => {
    expanded.value = false;
    measured.value = false;
    await nextTick();
    measure();
  },
  { immediate: true },
);
</script>

<template>
  <div class="min-w-0">
    <div
      class="overflow-hidden transition-[max-height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :style="{ maxHeight: clipMaxHeight }"
    >
      <div ref="contentRef">
        <slot />
      </div>
    </div>
    <button
      v-if="measured && (expandable || expanded)"
      type="button"
      class="mt-1 ml-auto block cursor-pointer border-0 bg-transparent p-0 font-medium text-primary transition-opacity duration-150 hover:opacity-70"
      :class="compact ? 'text-xs' : 'text-sm'"
      @click.stop="toggleExpanded"
    >
      {{ expanded ? t("common.collapse") : t("common.expand") }}
    </button>
  </div>
</template>
