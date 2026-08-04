<script setup lang="ts">
import type { FollowComment, FollowPost } from "@/types/follow";
import {
  FOLLOW_PAGE_SIZE,
  addFollowComment,
  deleteFollowPost,
  fetchFollowComments,
  fetchFollowFeed,
  fetchFollowUserHistory,
  fetchMentionUsers,
} from "@/apis/follow/netease";
import { useUserStore } from "@/stores/user";
import { useFloatingPlayerBar } from "@/composables/useFloatingPlayerBar";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const { isFloatingBar } = useFloatingPlayerBar();
const scrollRef = ref<HTMLElement | null>(null);
const items = shallowRef<FollowPost[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const loaded = ref(false);
const error = ref("");
const cursor = ref(-1);
const more = ref(false);
const publishOpen = ref(false);
const forwardOpen = ref(false);
const forwardPost = shallowRef<FollowPost | null>(null);
const inlineCommentPostId = ref<string | null>(null);
const inlineCommentText = ref("");
const inlineComments = shallowRef<FollowComment[]>([]);
const inlineCommentsLoading = ref(false);
const sendingComment = ref(false);
const HISTORY_SOURCE_LIMIT = 20;
const HISTORY_REQUEST_CONCURRENCY = 4;

interface HistorySource {
  userId: number;
  cursor: number;
  more: boolean;
  buffer: FollowPost[];
}

type HistoryResult = PromiseSettledResult<{
  source: HistorySource;
  page: Awaited<ReturnType<typeof fetchFollowUserHistory>>;
}>;

let feedMore = false;
let historySources: HistorySource[] = [];
let requestToken = 0;
let inlineCommentRequestToken = 0;

const currentUserId = computed(() => userStore.profile?.userId ?? 0);

const createHistorySource = (userId: number): HistorySource => ({
  userId,
  cursor: -1,
  more: true,
  buffer: [],
});

const hasMoreHistory = (): boolean =>
  historySources.some((source) => source.more || source.buffer.length > 0);

const resetHistorySources = (posts: FollowPost[], userIds: number[]): void => {
  const ids = [...posts.map((post) => post.user.id), ...userIds];
  historySources = [...new Set(ids)].slice(0, HISTORY_SOURCE_LIMIT).map(createHistorySource);
};

const extendHistorySources = (posts: FollowPost[]): void => {
  const known = new Set(historySources.map((source) => source.userId));
  for (const post of posts) {
    if (known.has(post.user.id) || historySources.length >= HISTORY_SOURCE_LIMIT) continue;
    known.add(post.user.id);
    historySources.push(createHistorySource(post.user.id));
  }
};

const fetchHistoryPage = async (): Promise<FollowPost[]> => {
  const sources = historySources.map((source) => ({
    ...source,
    buffer: [...source.buffer],
  }));
  const knownIds = new Set(items.value.map((item) => item.id));
  const posts: FollowPost[] = [];

  while (posts.length < FOLLOW_PAGE_SIZE) {
    const pending = sources.filter((source) => source.more && source.buffer.length === 0);
    const results: HistoryResult[] = [];

    for (let index = 0; index < pending.length; index += HISTORY_REQUEST_CONCURRENCY) {
      const batch = pending.slice(index, index + HISTORY_REQUEST_CONCURRENCY);
      results.push(
        ...(await Promise.allSettled(
          batch.map(async (source) => ({
            source,
            page: await fetchFollowUserHistory(source.userId, source.cursor, currentUserId.value),
          })),
        )),
      );
    }

    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { source, page } = result.value;
      const previousCursor = source.cursor;
      source.cursor = page.cursor;
      source.buffer = page.items
        .filter((item) => !knownIds.has(item.id))
        .sort((left, right) => right.createdAt - left.createdAt);
      source.more =
        page.more &&
        page.cursor >= 0 &&
        (page.cursor !== previousCursor || source.buffer.length > 0);
    }

    let latestSource: HistorySource | undefined;
    for (const source of sources) {
      const candidate = source.buffer[0];
      const latest = latestSource?.buffer[0];
      if (candidate && (!latest || candidate.createdAt > latest.createdAt)) {
        latestSource = source;
      }
    }
    if (!latestSource) break;

    const post = latestSource.buffer.shift();
    if (!post || knownIds.has(post.id)) continue;
    knownIds.add(post.id);
    posts.push(post);
  }

  historySources = sources;
  return posts;
};

const load = async (append = false): Promise<void> => {
  if (!currentUserId.value || loading.value || loadingMore.value) return;
  const token = ++requestToken;
  if (append) loadingMore.value = true;
  else loading.value = true;
  error.value = "";
  try {
    if (!append) {
      const [page, followedUsers] = await Promise.all([
        fetchFollowFeed(currentUserId.value),
        fetchMentionUsers(currentUserId.value).catch(() => []),
      ]);
      if (token !== requestToken) return;
      items.value = page.items;
      cursor.value = page.cursor;
      feedMore = page.more;
      resetHistorySources(page.items, [
        currentUserId.value,
        ...followedUsers.map((user) => user.id),
      ]);
      more.value = feedMore || hasMoreHistory();
      scrollRef.value?.scrollTo({ top: 0 });
    } else {
      const page = feedMore
        ? await fetchFollowFeed(currentUserId.value, cursor.value)
        : {
            items: await fetchHistoryPage(),
            cursor: cursor.value,
            more: false,
          };
      if (token !== requestToken) return;
      const existing = new Set(items.value.map((item) => item.id));
      const appended = page.items.filter((item) => !existing.has(item.id));
      items.value = [...items.value, ...appended];
      if (feedMore) {
        cursor.value = page.cursor;
        feedMore = page.more;
        extendHistorySources(appended);
      }
      more.value = feedMore || hasMoreHistory();
    }
    loaded.value = true;
  } catch (cause) {
    if (token !== requestToken) return;
    error.value = cause instanceof Error ? cause.message : String(cause);
    if (append) toast.error(error.value);
  } finally {
    if (token === requestToken) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
};

const refresh = (): Promise<void> => load(false);

watch(
  currentUserId,
  (id) => {
    requestToken += 1;
    items.value = [];
    loaded.value = false;
    cursor.value = -1;
    feedMore = false;
    historySources = [];
    more.value = false;
    inlineCommentRequestToken += 1;
    inlineCommentPostId.value = null;
    inlineCommentText.value = "";
    inlineComments.value = [];
    inlineCommentsLoading.value = false;
    if (id) void load();
  },
  { immediate: true },
);

const handleScroll = (): void => {
  const element = scrollRef.value;
  if (
    !element ||
    !more.value ||
    loadingMore.value ||
    element.scrollTop + element.clientHeight < element.scrollHeight - 320
  ) {
    return;
  }
  void load(true);
};

const openPost = (post: FollowPost): void => {
  router.push({
    name: "follow-detail",
    params: { uid: post.user.id, id: post.id },
  });
};

const openForward = (post: FollowPost): void => {
  forwardPost.value = post;
  forwardOpen.value = true;
};

const collapseInlineComment = (): void => {
  inlineCommentRequestToken += 1;
  inlineCommentPostId.value = null;
  inlineCommentText.value = "";
  inlineComments.value = [];
  inlineCommentsLoading.value = false;
};

const loadInlineComments = async (post: FollowPost, clear = false): Promise<void> => {
  const token = ++inlineCommentRequestToken;
  if (clear) inlineComments.value = [];
  inlineCommentsLoading.value = true;
  try {
    const page = await fetchFollowComments(post.threadId, 0, 5);
    if (token === inlineCommentRequestToken && inlineCommentPostId.value === post.id) {
      inlineComments.value = page.items.slice(0, 5);
    }
  } catch (cause) {
    if (token === inlineCommentRequestToken) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  } finally {
    if (token === inlineCommentRequestToken) inlineCommentsLoading.value = false;
  }
};

const toggleInlineComment = async (post: FollowPost): Promise<void> => {
  if (sendingComment.value) return;
  if (inlineCommentPostId.value === post.id) {
    collapseInlineComment();
    return;
  }
  inlineCommentPostId.value = post.id;
  inlineCommentText.value = "";
  inlineComments.value = [];
  void loadInlineComments(post, true);
  await nextTick();
  scrollRef.value
    ?.querySelector<HTMLTextAreaElement>("[data-follow-inline-comment] textarea")
    ?.focus();
};

const submitInlineComment = async (post: FollowPost): Promise<void> => {
  const content = inlineCommentText.value.trim();
  if (!content || sendingComment.value || inlineCommentPostId.value !== post.id) return;
  sendingComment.value = true;
  try {
    const comment = await addFollowComment(post.threadId, content);
    items.value = items.value.map((item) =>
      item.id === post.id ? { ...item, commentCount: item.commentCount + 1 } : item,
    );
    inlineCommentText.value = "";
    if (comment) {
      inlineComments.value = [
        comment,
        ...inlineComments.value.filter((item) => item.id !== comment.id),
      ].slice(0, 5);
    } else {
      const profile = userStore.profile;
      inlineComments.value = [
        {
          id: `local-${Date.now()}`,
          user: {
            id: profile?.userId ?? currentUserId.value,
            name: profile?.nickname ?? "",
            ...(profile?.avatarUrl ? { avatar: profile.avatarUrl } : {}),
          },
          text: content,
          createdAt: Date.now(),
          liked: false,
          likeCount: 0,
        },
        ...inlineComments.value,
      ].slice(0, 5);
      setTimeout(() => {
        if (inlineCommentPostId.value === post.id) void loadInlineComments(post);
      }, 1000);
    }
    toast.success(t("follow.comment.done"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    sendingComment.value = false;
  }
};

const removeInlineComment = (postId: string, commentId: string): void => {
  if (inlineCommentPostId.value === postId) {
    inlineComments.value = inlineComments.value.filter((comment) => comment.id !== commentId);
  }
  items.value = items.value.map((item) =>
    item.id === postId ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item,
  );
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
</script>

<template>
  <div class="h-full">
    <div ref="scrollRef" class="h-full overflow-y-auto" @scroll.passive="handleScroll">
      <div
        class="mx-auto flex max-w-[900px] flex-col px-6 pt-6"
        :class="isFloatingBar ? 'pb-28' : 'pb-10'"
      >
        <header class="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-on-surface">{{ t("follow.title") }}</h1>
            <p class="mt-1 text-sm text-on-surface-variant/55">{{ t("follow.subtitle") }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <SButton
              variant="ghost"
              circle
              :loading="loading"
              :disabled="!currentUserId"
              :title="t('common.refresh')"
              @click="refresh"
            >
              <template #icon><IconLucideRefreshCw /></template>
            </SButton>
            <SButton type="primary" round :disabled="!currentUserId" @click="publishOpen = true">
              <template #icon><IconLucideSquarePen /></template>
              {{ t("follow.publish.button") }}
            </SButton>
          </div>
        </header>

        <div
          v-if="!currentUserId"
          class="flex min-h-90 flex-col items-center justify-center gap-3 text-on-surface-variant/50"
        >
          <IconLucideUsersRound class="size-14 opacity-35" />
          <div class="text-base font-medium text-on-surface">{{ t("follow.loginRequired") }}</div>
          <p class="text-sm">{{ t("follow.loginHint") }}</p>
        </div>
        <div
          v-else-if="loading && !loaded"
          class="flex min-h-90 items-center justify-center gap-2 text-sm text-on-surface-variant/55"
        >
          <SLoading />
          {{ t("common.loading") }}
        </div>
        <div
          v-else-if="error && !items.length"
          class="flex min-h-90 flex-col items-center justify-center gap-3"
        >
          <IconLucideTriangleAlert class="size-12 text-red-500/55" />
          <div class="max-w-md text-center text-sm text-on-surface-variant">{{ error }}</div>
          <SButton variant="secondary" @click="refresh">{{ t("common.retry") }}</SButton>
        </div>
        <div
          v-else-if="loaded && !items.length"
          class="flex min-h-90 flex-col items-center justify-center gap-2 text-on-surface-variant/45"
        >
          <IconLucideNotebookPen class="size-13 opacity-35" />
          <div class="text-sm">{{ t("follow.empty") }}</div>
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
              <div v-if="inlineCommentPostId === post.id" data-follow-inline-comment class="mt-3">
                <FollowTextComposer
                  v-model="inlineCommentText"
                  :user-id="currentUserId"
                  :placeholder="t('follow.comment.placeholder')"
                  :maxlength="500"
                  :rows="3"
                  :disabled="sendingComment"
                  show-emoji
                />
                <div class="mt-2 flex justify-end">
                  <SButton
                    type="primary"
                    round
                    :disabled="!inlineCommentText.trim()"
                    :loading="sendingComment"
                    @click="submitInlineComment(post)"
                  >
                    {{ t("follow.comment.submit") }}
                  </SButton>
                </div>
                <div
                  v-if="inlineCommentsLoading && !inlineComments.length"
                  class="flex items-center justify-center gap-2 py-5 text-xs text-on-surface-variant/50"
                >
                  <SLoading />
                  {{ t("common.loading") }}
                </div>
                <div
                  v-else-if="!inlineComments.length"
                  class="py-4 text-center text-xs text-on-surface-variant/45"
                >
                  {{ t("follow.comment.empty") }}
                </div>
                <div v-else class="mt-3 space-y-2">
                  <FollowCommentCard
                    v-for="comment in inlineComments"
                    :key="comment.id"
                    :comment="comment"
                    :current-user-id="currentUserId"
                    :thread-id="post.threadId"
                    @deleted="removeInlineComment(post.id, $event)"
                  />
                </div>
                <div class="mt-2 flex justify-center">
                  <SButton
                    variant="text"
                    size="small"
                    :disabled="sendingComment"
                    @click="collapseInlineComment"
                  >
                    {{ t("follow.comment.collapse") }}
                  </SButton>
                </div>
              </div>
            </template>
          </FollowPostCard>
          <div
            v-if="loadingMore"
            class="flex items-center justify-center gap-2 py-4 text-xs text-on-surface-variant/45"
          >
            <SLoading />
            {{ t("common.loading") }}
          </div>
          <div
            v-else-if="loaded && !more"
            class="py-4 text-center text-xs text-on-surface-variant/35"
          >
            {{ t("follow.end") }}
          </div>
        </div>
      </div>
    </div>

    <FollowPublishDialog
      v-if="currentUserId"
      v-model:open="publishOpen"
      :user-id="currentUserId"
      @published="refresh"
    />
    <FollowForwardDialog
      v-if="currentUserId"
      v-model:open="forwardOpen"
      :post="forwardPost"
      :user-id="currentUserId"
      @forwarded="updateForwarded"
    />
  </div>
</template>
