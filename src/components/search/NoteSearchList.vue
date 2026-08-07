<script setup lang="ts">
import type { FollowPost } from "@/types/follow";
import { deleteFollowPost } from "@/apis/follow/netease";
import { useUserStore } from "@/stores/user";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import FollowInlineComments from "@/components/follow/FollowInlineComments.vue";

const props = defineProps<{
  items: FollowPost[];
  hasMore: boolean;
  loadingMore: boolean;
}>();

const emit = defineEmits<{
  reachBottom: [];
  remove: [postId: string];
  update: [post: FollowPost];
}>();

const { t } = useI18n();
const router = useRouter();
const user = useUserStore();
const forwardOpen = ref(false);
const forwardPost = shallowRef<FollowPost | null>(null);
const inlineCommentPostId = ref<string | null>(null);
const inlineCommentBusy = ref(false);
const scrollRef = shallowRef<HTMLElement | null>(null);
const scrollTop = ref(0);
const measuredHeights = shallowRef(new Map<string, number>());
const columnAssignments = shallowRef(new Map<string, number>());
const itemElements = new Map<string, HTMLElement>();
const currentUserId = computed(() => user.profile?.userId ?? 0);
const { width: viewportWidth, height: viewportHeight } = useElementSize(scrollRef);

const HORIZONTAL_PADDING = 24;
const COLUMN_GAP = 24;
const ROW_GAP = 12;
const TOP_PADDING = 8;
const BOTTOM_PADDING = 80;
const ESTIMATED_ITEM_HEIGHT = 420;
const COLUMN_BREAKPOINT = 860;

interface MasonryPosition {
  post: FollowPost;
  left: number;
  top: number;
  width: number;
  height: number;
  column: number;
}

const columnCount = computed(() => (viewportWidth.value >= COLUMN_BREAKPOINT ? 2 : 1));
const columnWidth = computed(() => {
  const available =
    viewportWidth.value - HORIZONTAL_PADDING * 2 - COLUMN_GAP * Math.max(0, columnCount.value - 1);
  return Math.max(0, available / columnCount.value);
});

const masonryLayout = computed(() => {
  const bottoms = Array.from({ length: columnCount.value }, () => TOP_PADDING);
  const positions = props.items.map<MasonryPosition>((post) => {
    const assignedColumn = columnAssignments.value.get(post.id);
    const column =
      columnCount.value === 1
        ? 0
        : assignedColumn !== undefined && assignedColumn < columnCount.value
          ? assignedColumn
          : bottoms.indexOf(Math.min(...bottoms));
    const height = measuredHeights.value.get(post.id) ?? ESTIMATED_ITEM_HEIGHT;
    const position = {
      post,
      left: HORIZONTAL_PADDING + column * (columnWidth.value + COLUMN_GAP),
      top: bottoms[column],
      width: columnWidth.value,
      height,
      column,
    };
    bottoms[column] += height + ROW_GAP;
    return position;
  });
  const contentHeight = Math.max(
    viewportHeight.value,
    Math.max(TOP_PADDING, ...bottoms) - ROW_GAP + BOTTOM_PADDING,
  );
  return { positions, contentHeight };
});

const visiblePositions = computed(() => {
  const buffer = Math.max(800, viewportHeight.value);
  const start = Math.max(0, scrollTop.value - buffer);
  const end = scrollTop.value + viewportHeight.value + buffer;
  return masonryLayout.value.positions.filter(
    (position) =>
      position.post.id === inlineCommentPostId.value ||
      (position.top + position.height >= start && position.top <= end),
  );
});

let resizeObserver: ResizeObserver | null = null;
let scrollRaf: number | null = null;
let pendingScrollTarget: HTMLElement | null = null;

const setItemElement = (postId: string, value: unknown): void => {
  const previous = itemElements.get(postId);
  if (previous) resizeObserver?.unobserve(previous);
  if (!(value instanceof HTMLElement)) {
    itemElements.delete(postId);
    return;
  }
  itemElements.set(postId, value);
  resizeObserver?.observe(value);
};

const measureItems = (entries: ResizeObserverEntry[]): void => {
  const next = new Map(measuredHeights.value);
  let changed = false;
  for (const entry of entries) {
    const element = entry.target as HTMLElement;
    const postId = element.dataset.masonryId;
    if (!postId) continue;
    const height = element.getBoundingClientRect().height;
    if (height > 0 && Math.abs(height - (next.get(postId) ?? 0)) > 0.5) {
      next.set(postId, height);
      changed = true;
    }
  }
  if (changed) measuredHeights.value = next;
};

const processScroll = (): void => {
  scrollRaf = null;
  const target = pendingScrollTarget;
  if (!target) return;
  scrollTop.value = target.scrollTop;
  if (
    props.hasMore &&
    !props.loadingMore &&
    target.scrollHeight - target.scrollTop - target.clientHeight < 240
  ) {
    emit("reachBottom");
  }
};

const handleScroll = (event: Event): void => {
  pendingScrollTarget = event.target as HTMLElement;
  if (scrollRaf === null) scrollRaf = requestAnimationFrame(processScroll);
};

const openPost = (post: FollowPost): void => {
  router.push({ name: "follow-detail", params: { uid: post.user.id, id: post.id } });
};

const openForward = (post: FollowPost): void => {
  forwardPost.value = post;
  forwardOpen.value = true;
};

const collapseInlineComment = (restorePost = false): void => {
  const postId = inlineCommentPostId.value;
  inlineCommentPostId.value = null;
  inlineCommentBusy.value = false;
  if (!restorePost || !postId) return;
  void nextTick(() => {
    const position = masonryLayout.value.positions.find((item) => item.post.id === postId);
    if (!position) return;
    scrollRef.value?.scrollTo({
      top: Math.max(0, position.top - TOP_PADDING),
      behavior: "smooth",
    });
  });
};

const toggleInlineComment = (post: FollowPost): void => {
  if (inlineCommentBusy.value) return;
  if (inlineCommentPostId.value === post.id) {
    collapseInlineComment(true);
    return;
  }
  if (columnCount.value > 1 && columnAssignments.value.size !== props.items.length) {
    columnAssignments.value = new Map(
      masonryLayout.value.positions.map((position) => [position.post.id, position.column]),
    );
  }
  inlineCommentPostId.value = post.id;
};

const removePost = async (post: FollowPost): Promise<void> => {
  const confirmed = await dialog.confirm({
    title: t("follow.delete.title"),
    content: t("follow.delete.confirm"),
    confirmText: t("follow.action.delete"),
    type: "error",
  });
  if (!confirmed) return;
  try {
    await deleteFollowPost(post.id);
    emit("remove", post.id);
    if (inlineCommentPostId.value === post.id) collapseInlineComment();
    toast.success(t("follow.delete.done"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
};

const updateLiked = (postId: string, liked: boolean): void => {
  const post = props.items.find((item) => item.id === postId);
  if (!post) return;
  emit("update", {
    ...post,
    liked,
    likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)),
  });
};

const updateForwarded = (postId: string): void => {
  const post = props.items.find((item) => item.id === postId);
  if (!post) return;
  emit("update", { ...post, shareCount: post.shareCount + 1 });
};

const updateCommentCount = (postId: string, delta: number): void => {
  const post = props.items.find((item) => item.id === postId);
  if (!post) return;
  emit("update", { ...post, commentCount: Math.max(0, post.commentCount + delta) });
};

watch(columnCount, () => {
  measuredHeights.value = new Map();
  columnAssignments.value = new Map();
});

watch(
  () => props.items.map((post) => post.id),
  (postIds) => {
    const retained = new Set(postIds);
    measuredHeights.value = new Map(
      [...measuredHeights.value].filter(([postId]) => retained.has(postId)),
    );
    columnAssignments.value = new Map(
      [...columnAssignments.value].filter(([postId]) => retained.has(postId)),
    );
    if (inlineCommentPostId.value && !retained.has(inlineCommentPostId.value)) {
      collapseInlineComment();
    }
  },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(measureItems);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  itemElements.clear();
  if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
});
</script>

<template>
  <div ref="scrollRef" class="relative h-full overflow-y-auto" @scroll.passive="handleScroll">
    <div class="relative w-full" :style="{ height: masonryLayout.contentHeight + 'px' }">
      <div
        v-for="position in visiblePositions"
        :key="position.post.id"
        :ref="(element) => setItemElement(position.post.id, element)"
        :data-masonry-id="position.post.id"
        class="absolute top-0"
        :style="{
          left: position.left + 'px',
          width: position.width + 'px',
          transform: `translateY(${position.top}px)`,
        }"
      >
        <FollowPostCard
          :post="position.post"
          compact-images
          @open="openPost"
          @comment="toggleInlineComment"
          @forward="openForward"
          @delete="removePost"
          @liked="updateLiked"
        >
          <template #comment>
            <FollowInlineComments
              v-if="inlineCommentPostId === position.post.id"
              :post="position.post"
              :current-user-id="currentUserId"
              @collapse="collapseInlineComment(true)"
              @busy="inlineCommentBusy = $event"
              @comment-count-changed="updateCommentCount"
            />
          </template>
        </FollowPostCard>
      </div>
      <div
        v-if="loadingMore"
        class="absolute inset-x-0 bottom-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant/45"
      >
        <SLoading />
        {{ t("common.loading") }}
      </div>
    </div>
  </div>

  <FollowForwardDialog
    v-if="currentUserId"
    v-model:open="forwardOpen"
    :post="forwardPost"
    :user-id="currentUserId"
    @forwarded="updateForwarded"
  />
</template>
