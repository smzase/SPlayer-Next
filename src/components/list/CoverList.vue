<script setup lang="ts">
import type { CoverItem } from "@/types/artist";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";
import { useFloatingPlayerBar, PLAYER_BAR_GAP } from "@/composables/useFloatingPlayerBar";
import { useSidebarHoverLayout } from "@/composables/useSidebarHoverLayout";

export interface CoverListProps {
  /** 列表数据 */
  items: CoverItem[];
  /** 列表类型 */
  type?: "default" | "artist";
  /** 是否虚拟滚动 */
  virtual?: boolean;
  /** 单项最小宽度（px） */
  minSize?: number;
  /** 项间距（px） */
  gap?: number;
  /** 封面圆角 class */
  rounded?: string;
  /** 封面占位图 */
  fallback?: string;
  /** 横向 padding（px） */
  paddingX?: number;
  /** 顶部 padding（px） */
  paddingTop?: number;
  /** 底部 padding（px） */
  paddingBottom?: number;
  /** 是否还能继续触底加载 */
  hasMore?: boolean;
  /** 触底加载中 */
  loadingMore?: boolean;
  /** 卡片右键菜单 */
  contextMenuItems?: DropdownMenuItem[];
  /** 悬停展开侧边栏时保持列数并缩放卡片 */
  shrinkOnSidebarHover?: boolean;
  /** 是否进入多选模式 */
  selectionMode?: boolean;
  /** 已选择资源 ID */
  selectedIds?: ReadonlySet<string>;
}

const props = withDefaults(defineProps<CoverListProps>(), {
  type: "default",
  virtual: true,
  minSize: 140,
  gap: 20,
  rounded: "rounded-xl",
  paddingX: 0,
  paddingTop: 0,
  paddingBottom: 0,
  hasMore: false,
  loadingMore: false,
  contextMenuItems: () => [],
  shrinkOnSidebarHover: false,
  selectionMode: false,
  selectedIds: () => new Set<string>(),
});

const { t } = useI18n();

const { isFloatingBar } = useFloatingPlayerBar();

/** 虚拟模式底部 padding：悬浮播放栏下留白避免遮挡 */
const virtualPaddingBottom = computed(() =>
  isFloatingBar.value ? PLAYER_BAR_GAP : props.paddingBottom,
);

const emit = defineEmits<{
  click: [item: CoverItem];
  reachBottom: [];
  contextMenu: [key: string, item: CoverItem];
  toggleSelection: [item: CoverItem];
}>();

const handleItemClick = (item: CoverItem): void => {
  if (props.selectionMode) {
    emit("toggleSelection", item);
    return;
  }
  emit("click", item);
};

const virtualListRef = ref<SVirtualListExposed | null>(null);
const scrollEl = computed(() => virtualListRef.value?.scrollRef ?? null);
const { width: scrollWidth } = useElementSize(scrollEl);

/** 实际可用网格宽度 = scrollEl 内容宽度 − 左右 padding */
const innerWidth = computed(() => Math.max(0, scrollWidth.value - props.paddingX * 2));

/** 信息区固定高度估算：标题 line-clamp-2 + 可选 subtitle + 上下 padding */
const INFO_HEIGHT = 76;

/** CSS auto-fill 等价计算：列数 = floor((W + G) / (M + G)) */
const calculateColumnCount = (width: number): number => {
  if (!width) return 1;
  return Math.max(1, Math.floor((width + props.gap) / (props.minSize + props.gap)));
};

const targetColumnCount = computed(() => calculateColumnCount(innerWidth.value));
const sidebarHoverLayout = useSidebarHoverLayout();
const keepColumnsDuringSidebarHover = computed(
  () => props.shrinkOnSidebarHover && sidebarHoverLayout?.hoverExpandActive.value === true,
);
const lockedColumnCount = ref(1);
const columnCount = computed(() =>
  keepColumnsDuringSidebarHover.value ? lockedColumnCount.value : targetColumnCount.value,
);
const SIDEBAR_WIDTH_DELTA = 176;
const SIDEBAR_TRANSITION_MS = 300;
let columnLockReady = false;
let previousHoverExpandActive = false;
let previousCollapsed = true;
let sidebarResizeTimer: ReturnType<typeof setTimeout> | undefined;

const clearSidebarResizeTimer = (): void => {
  if (!sidebarResizeTimer) return;
  clearTimeout(sidebarResizeTimer);
  sidebarResizeTimer = undefined;
};

watch(
  () =>
    [
      innerWidth.value,
      props.minSize,
      props.gap,
      keepColumnsDuringSidebarHover.value,
      sidebarHoverLayout?.collapsed.value ?? true,
    ] as const,
  ([width, , , hoverExpandActive, collapsed]) => {
    if (width <= 0) return;
    if (!columnLockReady) {
      const initialWidth = hoverExpandActive && !collapsed ? width + SIDEBAR_WIDTH_DELTA : width;
      lockedColumnCount.value = calculateColumnCount(initialWidth);
      previousHoverExpandActive = hoverExpandActive;
      previousCollapsed = collapsed;
      columnLockReady = true;
      return;
    }

    if (!hoverExpandActive) {
      clearSidebarResizeTimer();
      lockedColumnCount.value = targetColumnCount.value;
    } else if (!previousHoverExpandActive) {
      const initialWidth = collapsed ? width : width + SIDEBAR_WIDTH_DELTA;
      lockedColumnCount.value = calculateColumnCount(initialWidth);
    } else if (collapsed !== previousCollapsed) {
      clearSidebarResizeTimer();
      if (collapsed) {
        sidebarResizeTimer = setTimeout(() => {
          sidebarResizeTimer = undefined;
          if (keepColumnsDuringSidebarHover.value && sidebarHoverLayout?.collapsed.value) {
            lockedColumnCount.value = targetColumnCount.value;
          }
        }, SIDEBAR_TRANSITION_MS);
      }
    } else if (collapsed && !sidebarResizeTimer) {
      lockedColumnCount.value = targetColumnCount.value;
    }

    previousHoverExpandActive = hoverExpandActive;
    previousCollapsed = collapsed;
  },
  { immediate: true },
);

onBeforeUnmount(clearSidebarResizeTimer);

/** 单列实际宽度 */
const colWidth = computed(() => {
  if (!innerWidth.value) return props.minSize;
  return (innerWidth.value - (columnCount.value - 1) * props.gap) / columnCount.value;
});

/** 行高 = 封面方形（aspect-square = colWidth）+ 信息区 + 行间距 */
const rowHeight = computed(() => colWidth.value + INFO_HEIGHT + props.gap);

interface Row {
  id: string;
  items: CoverItem[];
}

/** 把 items 按列数切成行 */
const rows = computed<Row[]>(() => {
  const cols = columnCount.value;
  if (cols <= 0 || props.items.length === 0) return [];
  const out: Row[] = [];
  for (let i = 0; i < props.items.length; i += cols) {
    const slice = props.items.slice(i, i + cols);
    out.push({ id: slice[0]?.id ?? `__pad_${i}`, items: slice });
  }
  return out;
});

const getRowKey = (row: Row): string => row.id;
</script>

<template>
  <!-- 虚拟滚动 -->
  <SVirtualList
    v-if="virtual"
    ref="virtualListRef"
    :items="rows"
    :item-height="rowHeight"
    item-fixed
    :get-item-key="getRowKey"
    :padding-top="paddingTop"
    :padding-bottom="virtualPaddingBottom"
    height="100%"
    @reach-bottom="emit('reachBottom')"
  >
    <template #footer>
      <div
        v-if="rows.length > 0 && loadingMore"
        class="py-3 flex items-center justify-center gap-2 text-sm text-on-surface-variant/50"
      >
        <SLoading class="size-3.5 text-primary/70 shrink-0" />
        <span>{{ t("common.loading") }}</span>
      </div>
      <div
        v-else-if="rows.length > 0 && !hasMore"
        class="py-3 text-center text-sm text-on-surface-variant/40"
      >
        {{ t("common.noMore") }}
      </div>
    </template>
    <template #default="{ item: row }: { item: Row }">
      <div
        class="grid"
        :style="{
          paddingLeft: `${paddingX}px`,
          paddingRight: `${paddingX}px`,
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gap: `${gap}px`,
        }"
      >
        <template v-for="item in row.items" :key="item.id">
          <SContextMenu
            v-if="contextMenuItems.length > 0 && !selectionMode"
            :items="contextMenuItems"
            @select="emit('contextMenu', $event, item)"
          >
            <div class="relative">
              <CoverCard
                :item="item"
                :type="type"
                :rounded="rounded"
                :fallback="fallback"
                @click="handleItemClick(item)"
              />
            </div>
          </SContextMenu>
          <div v-else class="relative">
            <CoverCard
              :item="item"
              :type="type"
              :rounded="rounded"
              :fallback="fallback"
              @click="handleItemClick(item)"
            />
            <button
              v-if="selectionMode"
              type="button"
              class="absolute top-1 left-1 grid size-7 cursor-pointer place-items-center border-0 bg-transparent p-0"
              @click.stop="emit('toggleSelection', item)"
            >
              <SCheckbox
                :checked="selectedIds.has(item.id)"
                size="small"
                class="pointer-events-none"
              />
            </button>
          </div>
        </template>
      </div>
    </template>
  </SVirtualList>
  <!-- 普通网格 -->
  <div
    v-else
    class="grid"
    :style="{
      padding: `${paddingTop}px ${paddingX}px ${paddingBottom}px`,
      gridTemplateColumns: `repeat(auto-fill, minmax(${minSize}px, 1fr))`,
      gap: `${gap}px`,
    }"
  >
    <template v-for="item in items" :key="item.id">
      <SContextMenu
        v-if="contextMenuItems.length > 0 && !selectionMode"
        :items="contextMenuItems"
        @select="emit('contextMenu', $event, item)"
      >
        <div class="relative">
          <CoverCard
            :item="item"
            :type="type"
            :rounded="rounded"
            :fallback="fallback"
            @click="handleItemClick(item)"
          />
        </div>
      </SContextMenu>
      <div v-else class="relative">
        <CoverCard
          :item="item"
          :type="type"
          :rounded="rounded"
          :fallback="fallback"
          @click="handleItemClick(item)"
        />
        <button
          v-if="selectionMode"
          type="button"
          class="absolute top-1 left-1 grid size-7 cursor-pointer place-items-center border-0 bg-transparent p-0"
          @click.stop="emit('toggleSelection', item)"
        >
          <SCheckbox :checked="selectedIds.has(item.id)" size="small" class="pointer-events-none" />
        </button>
      </div>
    </template>
  </div>
</template>
