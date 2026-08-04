<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text?: string;
    emptyText?: string;
  }>(),
  {
    text: "",
    emptyText: "",
  },
);

const { t } = useI18n();
const textRef = shallowRef<HTMLElement | null>(null);
const expanded = ref(false);
const expandable = ref(false);
const animating = ref(false);
let animation: Animation | undefined;

/** 检查折叠状态下是否存在横向溢出 */
const measure = (): void => {
  const element = textRef.value;
  if (!element || expanded.value || animating.value) return;
  expandable.value = element.scrollWidth > element.clientWidth + 1;
};

useResizeObserver(textRef, measure);

watch(
  () => props.text,
  async () => {
    expanded.value = false;
    expandable.value = false;
    await nextTick();
    measure();
  },
  { immediate: true },
);

/** 在单行与完整简介之间平滑切换 */
const toggle = async (): Promise<void> => {
  const element = textRef.value;
  if (!element || animating.value) return;
  animation?.cancel();
  const from = element.getBoundingClientRect().height;
  element.style.height = from + "px";
  expanded.value = !expanded.value;
  animating.value = true;
  await nextTick();
  const to = expanded.value
    ? element.scrollHeight
    : Number.parseFloat(getComputedStyle(element).lineHeight);
  animation = element.animate([{ height: from + "px" }, { height: to + "px" }], {
    duration: 260,
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  });
  try {
    await animation.finished;
  } catch {
    return;
  } finally {
    element.style.height = "";
    animating.value = false;
  }
  if (!expanded.value) measure();
};

onBeforeUnmount(() => animation?.cancel());
</script>

<template>
  <div class="relative min-w-0">
    <p
      ref="textRef"
      class="m-0 overflow-hidden text-sm leading-6 text-on-surface-variant/70"
      :class="expanded ? 'whitespace-pre-wrap break-words' : 'truncate pr-12'"
    >
      {{ text || emptyText }}
    </p>
    <button
      v-if="text && (expandable || expanded)"
      type="button"
      class="border-0 bg-transparent p-0 text-sm font-medium text-primary transition-opacity duration-150 hover:opacity-70 disabled:pointer-events-none"
      :class="expanded ? 'mt-1 ml-auto block' : 'absolute right-0 top-0 leading-6'"
      :disabled="animating"
      @click="toggle"
    >
      {{ expanded ? t("common.collapse") : t("common.expand") }}
    </button>
  </div>
</template>
