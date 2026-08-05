<script setup lang="ts">
import type {
  CommentSource,
  CommentTarget,
  MusicCommentItem,
  MusicCommentPage,
} from "@shared/types/comment";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import ExpandableCommentContent from "@/components/comment/ExpandableCommentContent.vue";
import { useStatusStore } from "@/stores/status";
import { useUserStore } from "@/stores/user";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import { useCopyText } from "@/composables/useCopyText";
import { formatDate } from "@/utils/time";
import IconLucideCopy from "~icons/lucide/copy";
import IconLucideThumbsUp from "~icons/lucide/thumbs-up";
import IconLucideTrash2 from "~icons/lucide/trash-2";

const { t } = useI18n();
const router = useRouter();
const status = useStatusStore();
const user = useUserStore();
const { copy } = useCopyText();

const openUser = (userId?: string): void => {
  if (!userId) return;
  status.commentsOpen = false;
  router.push({ name: "user-profile", params: { uid: userId } });
};

const sources = shallowRef<CommentSource[]>([]);
const sourceId = ref("");
const activeTab = ref<"hot" | "new">("hot");
const loadingCount = ref(0);
const error = ref("");
const listScrollRef = ref<HTMLElement | null>(null);
const editorOpen = ref(false);
const editorVersion = ref(0);
const replyTarget = shallowRef<MusicCommentItem | null>(null);
const submitting = ref(false);
const likingIds = shallowRef(new Set<string>());
const deletingIds = shallowRef(new Set<string>());
let loadingEpoch = 0;
let suppressSourceRefresh = false;
let reconciliationTimers: number[] = [];

interface PendingComment {
  contextKey: string;
  item: MusicCommentItem;
  expiresAt: number;
}

const PENDING_COMMENT_TTL_MS = 2 * 60 * 1000;
const RECONCILIATION_DELAYS_MS = [3000, 10000, 30000] as const;
const pendingComments = shallowRef<PendingComment[]>([]);
const pages = reactive<Record<"hot" | "new", MusicCommentPage>>({
  hot: { list: [], total: 0, page: 1, limit: 20 },
  new: { list: [], total: 0, page: 1, limit: 20 },
});
const requestTokens = reactive<Record<"hot" | "new", number>>({
  hot: 0,
  new: 0,
});

const sourceOptions = computed(() =>
  sources.value.map((source) => ({ value: source.id, label: source.name })),
);
const tabs = computed(() => [
  { key: "hot", label: `${t("comments.hot")} (${pages.hot.total})` },
  { key: "new", label: `${t("comments.new")} (${pages.new.total})` },
]);

const loading = computed(() => loadingCount.value > 0);
const page = computed(() => pages[activeTab.value]);
const currentUserId = computed(() => user.profile?.userId ?? 0);
const writable = computed(() => {
  const target = status.commentsTarget;
  return (
    sourceId.value === "builtin:netease" &&
    currentUserId.value > 0 &&
    !!target &&
    (target.kind === "song" || target.source === "netease")
  );
});
const maxPage = computed(() =>
  Math.max(1, Math.ceil(page.value.total / Math.max(1, page.value.limit))),
);

const makeContextKey = (target: CommentTarget, source: string): string =>
  `${target.kind}\n${target.id}\n${source}`;

const editorDraftKey = computed(() => {
  const target = status.commentsTarget;
  if (!target || !sourceId.value) return "";
  return [
    currentUserId.value,
    target.kind,
    target.id,
    sourceId.value,
    replyTarget.value?.id ?? "new",
  ].join(":");
});

const clearReconciliationTimers = (): void => {
  for (const timer of reconciliationTimers) window.clearTimeout(timer);
  reconciliationTimers = [];
};

const isPendingMatch = (pending: MusicCommentItem, current: MusicCommentItem): boolean => {
  if (pending.id === current.id) return true;
  if (!pending.id.startsWith("local-")) return false;
  return (
    pending.userId === current.userId &&
    pending.text === current.text &&
    Math.abs((pending.time ?? 0) - (current.time ?? 0)) < PENDING_COMMENT_TTL_MS
  );
};

const mergePendingComments = (
  currentPage: MusicCommentPage,
  contextKey: string,
): MusicCommentPage => {
  const now = Date.now();
  const currentItems = currentPage.list;
  pendingComments.value = pendingComments.value.filter(
    (pending) =>
      pending.expiresAt > now &&
      (pending.contextKey !== contextKey ||
        !currentItems.some((item) => isPendingMatch(pending.item, item))),
  );
  const pendingItems = pendingComments.value
    .filter((pending) => pending.contextKey === contextKey)
    .map((pending) => pending.item);
  return {
    ...currentPage,
    list: [
      ...pendingItems,
      ...currentItems.filter(
        (item) => !pendingItems.some((pending) => isPendingMatch(pending, item)),
      ),
    ],
    total: currentPage.total + pendingItems.length,
  };
};

const scheduleReconciliation = (contextKey: string): void => {
  clearReconciliationTimers();
  reconciliationTimers = RECONCILIATION_DELAYS_MS.map((delay) =>
    window.setTimeout(() => {
      const target = status.commentsTarget;
      if (
        !status.commentsOpen ||
        !target ||
        makeContextKey(target, sourceId.value) !== contextKey
      ) {
        return;
      }
      void loadPage("new", 1);
    }, delay),
  );
};

const toApiTarget = (): CommentTarget | null => {
  const target = status.commentsTarget;
  if (!target) return null;
  return target.kind === "song" ? { ...toRaw(target), track: toRaw(target.track) } : toRaw(target);
};

const isOwn = (item: MusicCommentItem): boolean =>
  !!item.userId && item.userId === String(currentUserId.value);

const updateComment = (
  commentId: string,
  updater: (item: MusicCommentItem) => MusicCommentItem,
): void => {
  for (const type of ["hot", "new"] as const) {
    pages[type] = {
      ...pages[type],
      list: pages[type].list.map((item) => (item.id === commentId ? updater(item) : item)),
    };
  }
};

const setPending = (pending: ShallowRef<Set<string>>, commentId: string, value: boolean): void => {
  const next = new Set(pending.value);
  if (value) next.add(commentId);
  else next.delete(commentId);
  pending.value = next;
};

const menuItems = (item: MusicCommentItem): DropdownMenuItem[] => [
  {
    key: "copy",
    label: t("comments.actions.copy"),
    icon: markRaw(IconLucideCopy),
  },
  ...(isOwn(item) && writable.value && !item.id.startsWith("local-")
    ? [
        {
          key: "delete",
          label: t("common.delete"),
          icon: markRaw(IconLucideTrash2),
          separator: true,
          disabled: deletingIds.value.has(item.id),
        },
      ]
    : []),
];

const loadSources = async (): Promise<void> => {
  const target = status.commentsTarget;
  const available = await window.api.comments.sources();
  sources.value =
    target?.kind === "song"
      ? available
      : available.filter((source) => source.kind === "builtin" && source.platform === "netease");
  suppressSourceRefresh = true;
  if (!sources.value.some((source) => source.id === sourceId.value)) {
    sourceId.value = sources.value[0]?.id ?? "";
  }
  await nextTick();
  suppressSourceRefresh = false;
};

const resetPages = (): void => {
  requestTokens.hot += 1;
  requestTokens.new += 1;
  pages.hot = { list: [], total: 0, page: 1, limit: 20 };
  pages.new = { list: [], total: 0, page: 1, limit: 20 };
};

const loadPage = async (type: "hot" | "new", pageNo = 1): Promise<void> => {
  const target = status.commentsTarget;
  if (!target || !sourceId.value) return;
  const token = requestTokens[type] + 1;
  requestTokens[type] = token;
  const contextKey = makeContextKey(target, sourceId.value);
  const epoch = loadingEpoch;
  loadingCount.value += 1;
  error.value = "";
  try {
    const result = await window.api.comments.get({
      sourceId: sourceId.value,
      target:
        target.kind === "song" ? { ...toRaw(target), track: toRaw(target.track) } : toRaw(target),
      type,
      page: pageNo,
      limit: pages[type].limit,
    });
    if (!result.ok) throw new Error(result.error);
    if (!status.commentsOpen || requestTokens[type] !== token) return;
    const currentTarget = status.commentsTarget;
    if (!currentTarget || makeContextKey(currentTarget, sourceId.value) !== contextKey) return;
    pages[type] =
      type === "new" && pageNo === 1 ? mergePendingComments(result.data, contextKey) : result.data;
  } catch (err) {
    if (!status.commentsOpen || requestTokens[type] !== token) return;
    error.value = err instanceof Error ? err.message : String(err);
    toast.error(error.value);
  } finally {
    if (epoch === loadingEpoch) loadingCount.value = Math.max(0, loadingCount.value - 1);
  }
};

const refresh = async (): Promise<void> => {
  resetPages();
  await Promise.all([loadPage("hot"), loadPage("new")]);
  await nextTick();
  listScrollRef.value?.scrollTo({ top: 0 });
};

const changePage = async (delta: number): Promise<void> => {
  const next = Math.min(maxPage.value, Math.max(1, page.value.page + delta));
  if (next === page.value.page) return;
  await loadPage(activeTab.value, next);
  await nextTick();
  listScrollRef.value?.scrollTo({ top: 0 });
};

const openEditor = (item?: MusicCommentItem): void => {
  if (!writable.value || item?.id.startsWith("local-")) return;
  replyTarget.value = item ?? null;
  editorVersion.value += 1;
  editorOpen.value = true;
};

const createSubmittedComment = (
  content: string,
  returned: MusicCommentItem | undefined,
  repliedTo: MusicCommentItem | null,
): MusicCommentItem => {
  const profile = user.profile;
  const item: MusicCommentItem = {
    id: returned?.id ?? `local-${Date.now()}`,
    userId: returned?.userId ?? String(currentUserId.value),
    userName: returned?.userName || profile?.nickname || "",
    text: returned?.text || content,
    time: returned?.time ?? Date.now(),
    liked: returned?.liked ?? false,
    likedCount: returned?.likedCount ?? 0,
  };
  const avatar = returned?.avatar || profile?.avatarUrl;
  if (avatar) item.avatar = avatar;
  if (returned?.location) item.location = returned.location;
  if (returned?.reply?.length) {
    item.reply = returned.reply;
  } else if (repliedTo) {
    item.reply = [
      {
        id: repliedTo.id,
        userId: repliedTo.userId,
        userName: repliedTo.userName,
        avatar: repliedTo.avatar,
        text: repliedTo.text,
      },
    ];
  }
  return item;
};

const addPendingComment = (contextKey: string, item: MusicCommentItem): void => {
  pendingComments.value = [
    {
      contextKey,
      item,
      expiresAt: Date.now() + PENDING_COMMENT_TTL_MS,
    },
    ...pendingComments.value.filter(
      (pending) => pending.contextKey !== contextKey || pending.item.id !== item.id,
    ),
  ].slice(0, 20);
};

const submitComment = async (content: string): Promise<void> => {
  const target = toApiTarget();
  if (!target || !writable.value || submitting.value) return;
  submitting.value = true;
  try {
    const repliedTo = replyTarget.value;
    const result = repliedTo
      ? await window.api.comments.reply({
          sourceId: sourceId.value,
          target,
          commentId: repliedTo.id,
          content,
        })
      : await window.api.comments.add({
          sourceId: sourceId.value,
          target,
          content,
        });
    if (!result.ok) throw new Error(result.error);
    const contextKey = makeContextKey(target, sourceId.value);
    const submitted = createSubmittedComment(content, result.data, repliedTo);
    addPendingComment(contextKey, submitted);
    editorOpen.value = false;
    replyTarget.value = null;
    activeTab.value = "new";
    await loadPage("new", 1);
    scheduleReconciliation(contextKey);
    await nextTick();
    listScrollRef.value?.scrollTo({ top: 0 });
    toast.success(t(repliedTo ? "comments.replyDone" : "comments.publishDone"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    submitting.value = false;
  }
};

const toggleLike = async (item: MusicCommentItem): Promise<void> => {
  const target = toApiTarget();
  if (!target || !writable.value || item.id.startsWith("local-") || likingIds.value.has(item.id)) {
    return;
  }
  const liked = !item.liked;
  const previousCount = item.likedCount ?? 0;
  setPending(likingIds, item.id, true);
  updateComment(item.id, (current) => ({
    ...current,
    liked,
    likedCount: Math.max(0, previousCount + (liked ? 1 : -1)),
  }));
  try {
    const result = await window.api.comments.like({
      sourceId: sourceId.value,
      target,
      commentId: item.id,
      liked,
    });
    if (!result.ok) throw new Error(result.error);
  } catch (cause) {
    updateComment(item.id, (current) => ({
      ...current,
      liked: item.liked,
      likedCount: previousCount,
    }));
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    setPending(likingIds, item.id, false);
  }
};

const removeComment = async (item: MusicCommentItem): Promise<void> => {
  const target = toApiTarget();
  if (
    !target ||
    !writable.value ||
    !isOwn(item) ||
    item.id.startsWith("local-") ||
    deletingIds.value.has(item.id)
  ) {
    return;
  }
  const confirmed = await dialog.confirm({
    title: t("comments.deleteTitle"),
    content: t("comments.deleteConfirm"),
    confirmText: t("common.delete"),
    type: "error",
  });
  if (!confirmed) return;
  setPending(deletingIds, item.id, true);
  try {
    const result = await window.api.comments.delete({
      sourceId: sourceId.value,
      target,
      commentId: item.id,
    });
    if (!result.ok) throw new Error(result.error);
    for (const type of ["hot", "new"] as const) {
      const removed = pages[type].list.some((comment) => comment.id === item.id);
      pages[type] = {
        ...pages[type],
        list: pages[type].list.filter((comment) => comment.id !== item.id),
        total: removed ? Math.max(0, pages[type].total - 1) : pages[type].total,
      };
    }
    toast.success(t("comments.deleteDone"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    setPending(deletingIds, item.id, false);
  }
};

const handleMenu = (key: string, item: MusicCommentItem): void => {
  if (key === "copy") {
    void copy(item.text);
  } else if (key === "delete") {
    void removeComment(item);
  }
};

watch(
  () => status.commentsOpen,
  async (open) => {
    if (!open) {
      editorOpen.value = false;
      replyTarget.value = null;
      clearReconciliationTimers();
      loadingEpoch += 1;
      loadingCount.value = 0;
      requestTokens.hot += 1;
      requestTokens.new += 1;
      return;
    }
    await loadSources();
    await refresh();
  },
);

watch(sourceId, (next, prev) => {
  editorOpen.value = false;
  replyTarget.value = null;
  if (suppressSourceRefresh || !status.commentsOpen || !next || !prev || next === prev) return;
  refresh().catch(() => {});
});

onBeforeUnmount(clearReconciliationTimers);
</script>

<template>
  <SDialog
    v-model:open="status.commentsOpen"
    :title="
      status.commentsTarget
        ? t('comments.title', { name: status.commentsTarget.title })
        : t('comments.name')
    "
    width="min(860px, 92vw)"
    height="min(720px, 84vh)"
    destroy-on-close
  >
    <div class="flex h-full min-h-0 flex-col gap-3 px-5 pb-4">
      <div class="flex shrink-0 items-center gap-3">
        <div class="min-w-0 flex-1">
          <STabs v-model="activeTab" :tabs="tabs" type="bar" size="medium" />
        </div>
        <SButton variant="ghost" circle size="small" :loading="loading" @click="refresh">
          <template #icon><IconLucideRefreshCw /></template>
        </SButton>
        <div class="w-28 shrink-0">
          <SSelect
            v-model="sourceId"
            :options="sourceOptions"
            :disabled="sources.length === 0 || loading"
          />
        </div>
      </div>

      <div
        v-if="!sources.length"
        class="flex flex-1 items-center justify-center text-on-surface-variant"
      >
        <div class="text-center text-on-surface-variant/60">
          <IconLucideMessageCircleOff class="mx-auto mb-4 size-14 opacity-30" />
          <div class="text-sm">{{ t("comments.noSource") }}</div>
        </div>
      </div>
      <div
        v-else-if="error && page.list.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-3"
      >
        <div class="text-sm text-on-surface-variant">{{ error }}</div>
        <SButton variant="outline" @click="loadPage(activeTab, page.page)">
          {{ t("common.retry") }}
        </SButton>
      </div>
      <div
        v-else-if="page.list.length === 0 && loading"
        class="flex flex-1 items-center justify-center text-on-surface-variant"
      >
        <div class="text-center text-on-surface-variant/60">
          <SLoading class="mx-auto mb-4 block text-4xl text-primary/70" />
          <div class="text-sm">{{ t("comments.loading") }}</div>
        </div>
      </div>
      <div
        v-else-if="page.list.length === 0"
        class="flex flex-1 items-center justify-center text-on-surface-variant"
      >
        <div class="text-center text-on-surface-variant/60">
          <IconLucideMessageCircleOff class="mx-auto mb-4 size-14 opacity-30" />
          <div class="text-sm">{{ t("comments.empty") }}</div>
        </div>
      </div>
      <div v-else ref="listScrollRef" class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div>
          <div v-for="item in page.list" :key="item.id" class="mb-2 last:mb-0">
            <SContextMenu :items="menuItems(item)" @select="handleMenu($event, item)">
              <SCard size="small" radius="lg" class="select-text">
                <div class="flex gap-3">
                  <button
                    type="button"
                    class="h-9 w-9 shrink-0 overflow-hidden rounded-full border-0 bg-on-surface/8 p-0 ring-1 ring-black/10 dark:ring-white/10"
                    :class="item.userId ? 'cursor-pointer' : 'cursor-default'"
                    :disabled="!item.userId"
                    @click="openUser(item.userId)"
                  >
                    <SImg v-if="item.avatar" :src="item.avatar" class="size-full" alt="" />
                    <IconLucideUserRound v-else class="m-auto size-4 text-on-surface-variant/45" />
                  </button>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <button
                          type="button"
                          class="max-w-full truncate border-0 bg-transparent p-0 text-left text-sm font-medium transition-colors hover:text-primary"
                          :class="item.userId ? 'cursor-pointer' : 'cursor-default'"
                          :disabled="!item.userId"
                          @click="openUser(item.userId)"
                        >
                          {{ item.userName }}
                        </button>
                        <div class="mt-0.5 flex gap-2 text-xs text-on-surface-variant">
                          <span v-if="item.time">{{ formatDate(item.time) }}</span>
                          <span v-if="item.location">
                            {{ t("comments.location", { location: item.location }) }}
                          </span>
                        </div>
                      </div>
                      <div class="flex shrink-0 select-none items-center gap-0.5">
                        <span
                          v-if="item.likedCount"
                          class="mr-0.5 text-xs tabular-nums text-on-surface-variant/55"
                        >
                          {{ item.likedCount }}
                        </span>
                        <SButton
                          variant="ghost"
                          circle
                          size="small"
                          :class="item.liked ? 'text-primary' : 'text-on-surface-variant/55'"
                          :loading="likingIds.has(item.id)"
                          :disabled="!writable || item.id.startsWith('local-')"
                          :title="
                            writable
                              ? item.liked
                                ? t('comments.actions.unlike')
                                : t('comments.actions.like')
                              : t('comments.writeUnavailable')
                          "
                          @click="toggleLike(item)"
                        >
                          <template #icon><IconLucideThumbsUp /></template>
                        </SButton>
                        <SButton
                          variant="ghost"
                          circle
                          size="small"
                          :disabled="!writable || item.id.startsWith('local-')"
                          :title="
                            writable ? t('comments.actions.reply') : t('comments.writeUnavailable')
                          "
                          @click="openEditor(item)"
                        >
                          <template #icon><IconLucideReply /></template>
                        </SButton>
                        <SButton
                          v-if="writable && isOwn(item) && !item.id.startsWith('local-')"
                          variant="ghost"
                          circle
                          size="small"
                          :loading="deletingIds.has(item.id)"
                          :title="t('common.delete')"
                          @click="removeComment(item)"
                        >
                          <template #icon><IconLucideTrash2 /></template>
                        </SButton>
                      </div>
                    </div>
                    <ExpandableCommentContent class="mt-2" :content-key="item.text">
                      <FollowRichText
                        class="m-0"
                        :text="item.text"
                        @navigate="status.commentsOpen = false"
                      />
                    </ExpandableCommentContent>
                    <div
                      v-if="item.reply?.length"
                      class="mt-2 rounded-md bg-on-surface/5 px-3 py-2"
                    >
                      <ExpandableCommentContent
                        v-for="reply in item.reply"
                        :key="reply.id"
                        :content-key="reply.text"
                        :line-height="20"
                        compact
                      >
                        <div class="text-xs leading-5 text-on-surface-variant">
                          <button
                            type="button"
                            class="cursor-pointer border-0 bg-transparent p-0 font-medium text-on-surface transition-colors hover:text-primary"
                            @click="openUser(reply.userId)"
                          >
                            {{ reply.userName }}：
                          </button>
                          <FollowRichText
                            class="m-0 inline text-xs leading-5 text-on-surface-variant"
                            :text="reply.text"
                            @navigate="status.commentsOpen = false"
                          />
                        </div>
                      </ExpandableCommentContent>
                    </div>
                  </div>
                </div>
              </SCard>
            </SContextMenu>
          </div>
        </div>
      </div>

      <div
        v-if="sources.length"
        class="flex shrink-0 items-center justify-between text-xs text-on-surface-variant"
      >
        <span>{{ t("comments.page", { page: page.page, total: maxPage }) }}</span>
        <div class="flex gap-2">
          <SButton
            size="small"
            variant="secondary"
            :disabled="!writable"
            :title="writable ? t('comments.editor.title') : t('comments.writeUnavailable')"
            @click="openEditor()"
          >
            <template #icon><IconLucideMessageSquarePlus /></template>
            {{ t("comments.editor.title") }}
          </SButton>
          <SButton
            size="small"
            variant="secondary"
            :disabled="page.page <= 1 || loading"
            @click="changePage(-1)"
          >
            {{ t("common.prev") }}
          </SButton>
          <SButton
            size="small"
            variant="secondary"
            :disabled="page.page >= maxPage || loading"
            @click="changePage(1)"
          >
            {{ t("common.next") }}
          </SButton>
        </div>
      </div>
    </div>
  </SDialog>

  <MusicCommentEditorDialog
    :key="editorVersion"
    v-model:open="editorOpen"
    :user-id="currentUserId"
    :submitting="submitting"
    :reply-to="replyTarget?.userName"
    :draft-key="editorDraftKey"
    @submit="submitComment"
  />
</template>
