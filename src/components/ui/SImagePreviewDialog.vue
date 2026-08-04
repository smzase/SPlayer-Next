<script setup lang="ts">
import { useImageActions } from "@/composables/useImageActions";

const props = withDefaults(
  defineProps<{
    open: boolean;
    src?: string;
    sources?: string[];
    initialIndex?: number;
    title: string;
    alt: string;
  }>(),
  {
    src: "",
    sources: () => [],
    initialIndex: 0,
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { t } = useI18n();
const { menuItems: imageMenuItems, handleAction: handleImageAction } = useImageActions();
const imageIndex = ref(0);
const navigationSide = ref<"left" | "right" | null>(null);
const imageSources = computed(() =>
  props.sources.length > 0 ? props.sources.filter(Boolean) : props.src ? [props.src] : [],
);
const currentSrc = computed(() => imageSources.value[imageIndex.value] ?? "");
const canNavigate = computed(() => imageSources.value.length > 1);

const normalizeIndex = (index: number): number => {
  const length = imageSources.value.length;
  return length ? (index + length) % length : 0;
};

const showPrevious = (): void => {
  imageIndex.value = normalizeIndex(imageIndex.value - 1);
};

const showNext = (): void => {
  imageIndex.value = normalizeIndex(imageIndex.value + 1);
};

const updateNavigationSide = (event: PointerEvent): void => {
  if (!canNavigate.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const threshold = Math.min(140, rect.width * 0.22);
  navigationSide.value =
    pointerX <= threshold ? "left" : pointerX >= rect.width - threshold ? "right" : null;
};

watch(
  () => [props.open, props.initialIndex, imageSources.value.length] as const,
  ([open, initialIndex]) => {
    if (open) imageIndex.value = normalizeIndex(initialIndex);
    else navigationSide.value = null;
  },
  { immediate: true },
);

useEventListener(window, "keydown", (event) => {
  if (!props.open || !canNavigate.value) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    showPrevious();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    showNext();
  }
});
</script>

<template>
  <SDialog
    :open="open"
    :title="title"
    width="min(92vw, 1120px)"
    height="min(86vh, 840px)"
    :content-style="{ padding: 0, overflow: 'hidden' }"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <div
      class="relative flex size-full min-h-0 items-center justify-center bg-black/80 p-4"
      @pointermove="updateNavigationSide"
      @pointerleave="navigationSide = null"
    >
      <SContextMenu
        v-if="open && currentSrc"
        :items="imageMenuItems"
        @select="handleImageAction($event, currentSrc)"
      >
        <img
          :key="currentSrc"
          :src="currentSrc"
          :alt="alt"
          class="max-h-full max-w-full object-contain"
          decoding="async"
          draggable="false"
          referrerpolicy="no-referrer"
        />
      </SContextMenu>
      <template v-if="canNavigate">
        <SButton
          variant="ghost"
          circle
          class="absolute left-4 bg-black/40! text-white! shadow-lg backdrop-blur-sm transition-opacity duration-200 hover:bg-black/60!"
          :class="
            navigationSide === 'left'
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          "
          :title="t('common.prev')"
          :aria-label="t('common.prev')"
          @click="showPrevious"
        >
          <template #icon><IconLucideArrowLeft /></template>
        </SButton>
        <SButton
          variant="ghost"
          circle
          class="absolute right-4 bg-black/40! text-white! shadow-lg backdrop-blur-sm transition-opacity duration-200 hover:bg-black/60!"
          :class="
            navigationSide === 'right'
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          "
          :title="t('common.next')"
          :aria-label="t('common.next')"
          @click="showNext"
        >
          <template #icon><IconLucideArrowRight /></template>
        </SButton>
        <div
          class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-xs tabular-nums text-white/85 backdrop-blur-sm"
        >
          {{ imageIndex + 1 }} / {{ imageSources.length }}
        </div>
      </template>
    </div>
  </SDialog>
</template>
