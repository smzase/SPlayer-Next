<script setup lang="ts">
import type { FollowPost } from "@/types/follow";
import { deleteFollowPost, fetchFollowUserHistory } from "@/apis/follow/netease";
import { useUserStore } from "@/stores/user";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import FollowInlineComments from "@/components/follow/FollowInlineComments.vue";

const props = defineProps<{
  userId: number;
}>();

const { t } = useI18n();
const router = useRouter();
const user = useUserStore();
const items = shallowRef<FollowPost[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const loaded = ref(false);
const error = ref("");
const cursor = ref(-1);
const more = ref(false);
const forwardOpen = ref(false);
const forwardPost = shallowRef<FollowPost | null>(null);
const inlineCommentPostId = ref<string | null>(null);
const inlineCommentBusy = ref(false);
let requestToken = 0;

const currentUserId = computed(() => user.profile?.userId ?? 0);

const load = async (append = false): Promise<void> => {
  if (!props.userId || loading.value || loadingMore.value) return;
  const token = ++requestToken;
  if (append) loadingMore.value = true;
  else loading.value = true;
  error.value = "";
  try {
    const page = await fetchFollowUserHistory(
      props.userId,
      append ? cursor.value : -1,
      currentUserId.value,
    );
    if (token !== requestToken) return;
    if (append) {
      const existing = new Set(items.value.map((item) => item.id));
      items.value = [...items.value, ...page.items.filter((item) => !existing.has(item.id))];
    } else {
      items.value = page.items;
    }
    cursor.value = page.cursor;
    more.value = page.more;
    loaded.value = true;
  } catch (cause) {
    if (token !== requestToken) return;
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (token === requestToken) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
};

watch(
  () => props.userId,
  () => {
    requestToken += 1;
    items.value = [];
    cursor.value = -1;
    more.value = false;
    loaded.value = false;
    inlineCommentPostId.value = null;
    inlineCommentBusy.value = false;
    void load();
  },
  { immediate: true },
);

const openPost = (post: FollowPost): void => {
  router.push({ name: "follow-detail", params: { uid: post.user.id, id: post.id } });
};

const collapseInlineComment = (): void => {
  inlineCommentPostId.value = null;
  inlineCommentBusy.value = false;
};

const toggleInlineComment = (post: FollowPost): void => {
  if (inlineCommentBusy.value) return;
  if (inlineCommentPostId.value === post.id) {
    collapseInlineComment();
    return;
  }
  inlineCommentPostId.value = post.id;
};

const openForward = (post: FollowPost): void => {
  forwardPost.value = post;
  forwardOpen.value = true;
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
    items.value = items.value.filter((item) => item.id !== post.id);
    if (inlineCommentPostId.value === post.id) collapseInlineComment();
    toast.success(t("follow.delete.done"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
};

const updateLiked = (postId: string, liked: boolean): void => {
  items.value = items.value.map((item) =>
    item.id === postId
      ? {
          ...item,
          liked,
          likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)),
        }
      : item,
  );
};

const updateForwarded = (postId: string): void => {
  items.value = items.value.map((item) =>
    item.id === postId ? { ...item, shareCount: item.shareCount + 1 } : item,
  );
};

const updateCommentCount = (postId: string, delta: number): void => {
  items.value = items.value.map((item) =>
    item.id === postId ? { ...item, commentCount: Math.max(0, item.commentCount + delta) } : item,
  );
};
</script>

<template>
  <div>
    <div
      v-if="loading && !loaded"
      class="flex min-h-64 items-center justify-center gap-2 text-sm text-on-surface-variant/55"
    >
      <SLoading />
      {{ t("common.loading") }}
    </div>
    <div
      v-else-if="error && !items.length"
      class="flex min-h-64 flex-col items-center justify-center gap-3"
    >
      <IconLucideTriangleAlert class="size-10 text-red-500/55" />
      <p class="max-w-md text-center text-sm text-on-surface-variant">{{ error }}</p>
      <SButton variant="secondary" @click="load()">{{ t("common.retry") }}</SButton>
    </div>
    <div
      v-else-if="loaded && !items.length"
      class="flex min-h-64 flex-col items-center justify-center gap-2 text-on-surface-variant/45"
    >
      <IconLucideNotebookPen class="size-12 opacity-35" />
      <p class="text-sm">{{ t("userProfile.notesEmpty") }}</p>
    </div>
    <div v-else class="space-y-3">
      <FollowPostCard
        v-for="post in items"
        :key="post.id"
        :post="post"
        @open="openPost"
        @comment="toggleInlineComment"
        @forward="openForward"
        @delete="removePost"
        @liked="updateLiked"
      >
        <template #comment>
          <FollowInlineComments
            v-if="inlineCommentPostId === post.id"
            :post="post"
            :current-user-id="currentUserId"
            @collapse="collapseInlineComment"
            @busy="inlineCommentBusy = $event"
            @comment-count-changed="updateCommentCount"
          />
        </template>
      </FollowPostCard>
      <div v-if="more || loadingMore" class="flex justify-center py-3">
        <SButton variant="text" :loading="loadingMore" @click="load(true)">
          {{ t("common.loadMore") }}
        </SButton>
      </div>
      <div
        v-else-if="loaded && items.length"
        class="py-3 text-center text-xs text-on-surface-variant/35"
      >
        {{ t("follow.end") }}
      </div>
    </div>

    <FollowForwardDialog
      v-if="currentUserId"
      v-model:open="forwardOpen"
      :post="forwardPost"
      :user-id="currentUserId"
      @forwarded="updateForwarded"
    />
  </div>
</template>
