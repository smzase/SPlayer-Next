<script setup lang="ts">
import {
  fetchCommentMessages,
  fetchMentionMessages,
  fetchNoticeMessages,
  fetchPrivateThreads,
  MESSAGE_PAGE_SIZE,
} from "@/apis/message/netease";
import { toast } from "@/composables/useToast";
import { useMessageStore } from "@/stores/message";
import { useUserStore } from "@/stores/user";
import type {
  ActivityMessage,
  MessageCategory,
  MessageUser,
  PrivateMessageThread,
} from "@/types/message";
import { formatMessageTime } from "@/utils/format/message-time";

const props = defineProps<{ open: boolean; resizing?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();

type ActivityCategory = Exclude<MessageCategory, "private">;

const { t, locale } = useI18n();
const user = useUserStore();
const message = useMessageStore();
const activeTab = ref<MessageCategory>("private");
const currentThread = shallowRef<MessageUser | null>(null);
const privateThreads = shallowRef<PrivateMessageThread[]>([]);
const activityItems = shallowRef<Record<ActivityCategory, ActivityMessage[]>>({
  comment: [],
  mention: [],
  notice: [],
});
const loading = reactive<Record<MessageCategory, boolean>>({
  private: false,
  comment: false,
  mention: false,
  notice: false,
});
const loadingMore = reactive<Record<MessageCategory, boolean>>({
  private: false,
  comment: false,
  mention: false,
  notice: false,
});
const errors = reactive<Record<MessageCategory, string>>({
  private: "",
  comment: "",
  mention: "",
  notice: "",
});
const more = reactive<Record<MessageCategory, boolean>>({
  private: false,
  comment: false,
  mention: false,
  notice: false,
});
const cursors = reactive<Record<ActivityCategory, number>>({
  comment: -1,
  mention: 0,
  notice: -1,
});
const loaded = reactive<Record<MessageCategory, boolean>>({
  private: false,
  comment: false,
  mention: false,
  notice: false,
});
const requestTokens = reactive<Record<MessageCategory, number>>({
  private: 0,
  comment: 0,
  mention: 0,
  notice: 0,
});
const listScrollRef = ref<HTMLElement | null>(null);
const listScrollPositions = reactive<Record<MessageCategory, number>>({
  private: 0,
  comment: 0,
  mention: 0,
  notice: 0,
});
const canScrollToTop = ref(false);
const MAX_LIST_ITEMS = 300;
const VISIBLE_POLL_INTERVAL_MS = 10_000;

const tabs = computed(() =>
  (["private", "comment", "mention", "notice"] as MessageCategory[]).map((category) => {
    const count = message.unread[category];
    return {
      key: category,
      label: `${t(`messages.tabs.${category}`)}${count > 0 ? ` (${count > 99 ? "99+" : count})` : ""}`,
    };
  }),
);

const mergeById = <T extends { id: string }>(current: T[], next: T[]): T[] => {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))].slice(0, MAX_LIST_ITEMS);
};

/** 记录当前消息分类的滚动位置 */
const saveListScroll = (category: MessageCategory): void => {
  if (!listScrollRef.value) return;
  listScrollPositions[category] = listScrollRef.value.scrollTop;
};

/** 在分类内容完成渲染后恢复滚动位置 */
const restoreListScroll = async (category: MessageCategory): Promise<void> => {
  const targetScrollTop = listScrollPositions[category];
  await nextTick();
  if (activeTab.value !== category || currentThread.value || !listScrollRef.value) return;
  listScrollRef.value.scrollTop = targetScrollTop;
  listScrollPositions[category] = listScrollRef.value.scrollTop;
  canScrollToTop.value = listScrollRef.value.scrollTop > 100;
};

/** 同步当前分类滚动位置和回顶按钮状态 */
const handleListScroll = (event: Event): void => {
  if (!loaded[activeTab.value]) return;
  const container = event.currentTarget as HTMLElement;
  listScrollPositions[activeTab.value] = container.scrollTop;
  canScrollToTop.value = container.scrollTop > 100;
};

/** 平滑返回当前消息分类顶部 */
const scrollListToTop = (): void => {
  listScrollRef.value?.scrollTo({ top: 0, behavior: "smooth" });
};

/** 切换消息分类前保存当前分类的滚动位置 */
const selectCategory = (category: string): void => {
  const nextCategory = category as MessageCategory;
  if (nextCategory === activeTab.value) return;
  saveListScroll(activeTab.value);
  canScrollToTop.value = false;
  activeTab.value = nextCategory;
};

/** 重置浮窗内的短生命周期列表 */
const resetLists = (): void => {
  privateThreads.value = [];
  activityItems.value = { comment: [], mention: [], notice: [] };
  for (const category of ["private", "comment", "mention", "notice"] as MessageCategory[]) {
    requestTokens[category] += 1;
    loading[category] = false;
    loadingMore[category] = false;
    errors[category] = "";
    more[category] = false;
    loaded[category] = false;
  }
  cursors.comment = -1;
  cursors.mention = 0;
  cursors.notice = -1;
};

/**
 * 加载私信会话列表
 * @param reset - 是否从第一页重新加载
 */
const loadPrivate = async (reset: boolean): Promise<void> => {
  const currentUserId = user.profile?.userId;
  if (!currentUserId) return;
  const token = ++requestTokens.private;
  if (reset) loading.private = true;
  else loadingMore.private = true;
  errors.private = "";
  try {
    const offset = reset ? 0 : privateThreads.value.length;
    const limit = Math.min(MESSAGE_PAGE_SIZE, MAX_LIST_ITEMS - offset);
    if (limit <= 0) {
      more.private = false;
      return;
    }
    const page = await fetchPrivateThreads(currentUserId, offset, limit);
    if (token !== requestTokens.private || !props.open) return;
    privateThreads.value = reset ? page.items : mergeById(privateThreads.value, page.items);
    more.private = page.more && privateThreads.value.length < MAX_LIST_ITEMS;
    loaded.private = true;
    message.markCategoryRead("private");
    await restoreListScroll("private");
  } catch (cause) {
    if (token !== requestTokens.private) return;
    errors.private = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (token === requestTokens.private) {
      loading.private = false;
      loadingMore.private = false;
    }
  }
};

/**
 * 加载评论、提及或通知列表
 * @param category - 消息分类
 * @param reset - 是否从第一页重新加载
 */
const loadActivity = async (category: ActivityCategory, reset: boolean): Promise<void> => {
  const currentUserId = user.profile?.userId;
  if (!currentUserId) return;
  const token = ++requestTokens[category];
  if (reset) loading[category] = true;
  else loadingMore[category] = true;
  errors[category] = "";
  try {
    const current = reset ? [] : activityItems.value[category];
    const limit = Math.min(MESSAGE_PAGE_SIZE, MAX_LIST_ITEMS - current.length);
    if (limit <= 0) {
      more[category] = false;
      return;
    }
    const page =
      category === "comment"
        ? await fetchCommentMessages(currentUserId, reset ? -1 : cursors.comment, limit)
        : category === "mention"
          ? await fetchMentionMessages(reset ? 0 : current.length, limit)
          : await fetchNoticeMessages(reset ? -1 : cursors.notice, limit);
    if (token !== requestTokens[category] || !props.open) return;
    activityItems.value = {
      ...activityItems.value,
      [category]: reset ? page.items : mergeById(current, page.items),
    };
    if (category === "mention") cursors.mention = activityItems.value.mention.length;
    else if (page.cursor !== undefined) cursors[category] = page.cursor;
    more[category] = page.more && activityItems.value[category].length < MAX_LIST_ITEMS;
    loaded[category] = true;
    message.markCategoryRead(category);
    await restoreListScroll(category);
  } catch (cause) {
    if (token !== requestTokens[category]) return;
    errors[category] = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (token === requestTokens[category]) {
      loading[category] = false;
      loadingMore[category] = false;
    }
  }
};

/** 加载当前标签 */
const loadCategory = (category: MessageCategory, reset: boolean): Promise<void> =>
  category === "private" ? loadPrivate(reset) : loadActivity(category, reset);

/** 进入指定私信会话 */
const openThread = (threadUser: MessageUser): void => {
  saveListScroll("private");
  void loadPrivate(true);
  currentThread.value = { ...threadUser };
};

/** 返回私信会话列表 */
const closeThread = (): void => {
  currentThread.value = null;
  if (!loaded.private && !loading.private) void loadPrivate(true);
  void restoreListScroll("private");
};

/** 一次读取四类消息 */
const markAllRead = async (): Promise<void> => {
  const userId = user.profile?.userId;
  if (!userId) return;
  try {
    await message.markAllRead(userId);
    toast.success(t("messages.markAllReadDone"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
};

/** 刷新当前可见的消息分类 */
const pollVisibleCategory = async (): Promise<void> => {
  const category = activeTab.value;
  if (
    !props.open ||
    currentThread.value ||
    document.hidden ||
    loading[category] ||
    loadingMore[category]
  ) {
    return;
  }
  try {
    await message.refreshUnread();
  } catch {
    // 未读数量刷新失败不阻止当前分类继续更新
  }
  await loadCategory(category, true);
};

const documentVisibility = useDocumentVisibility();
const { pause: pauseMessagePolling, resume: resumeMessagePolling } = useIntervalFn(
  pollVisibleCategory,
  VISIBLE_POLL_INTERVAL_MS,
  { immediate: false },
);

/** 再次点击当前分类时立即刷新 */
const refreshSelectedCategory = (category: string): void => {
  if (category !== activeTab.value) return;
  void pollVisibleCategory();
};

watch(
  [() => props.open, documentVisibility, currentThread],
  ([open, visibility, thread]) => {
    if (open && visibility === "visible" && !thread) resumeMessagePolling();
    else pauseMessagePolling();
  },
  { immediate: true },
);

watch(activeTab, (category) => {
  currentThread.value = null;
  message.markCategoryRead(category);
  if (props.open && !loaded[category] && !loading[category]) void loadCategory(category, true);
  else void restoreListScroll(category);
});

watch(
  () => props.open,
  (open) => {
    if (!open) {
      if (!currentThread.value) saveListScroll(activeTab.value);
      message.rememberView(activeTab.value, currentThread.value, listScrollPositions);
      for (const category of ["private", "comment", "mention", "notice"] as MessageCategory[]) {
        requestTokens[category] += 1;
      }
      return;
    }
    resetLists();
    const restored = message.restoreView();
    for (const category of ["private", "comment", "mention", "notice"] as MessageCategory[]) {
      listScrollPositions[category] = restored?.scrollPositions[category] ?? 0;
    }
    canScrollToTop.value = false;
    const category = restored?.category ?? "private";
    activeTab.value = category;
    currentThread.value = null;
    message.markCategoryRead(category);
    void loadCategory(category, true);
    if (category === "private" && restored?.thread) {
      const restoredThread = { ...restored.thread };
      void nextTick(() => {
        if (props.open) currentThread.value = restoredThread;
      });
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header
      v-if="!currentThread"
      class="flex shrink-0 items-center justify-between gap-3 border-b border-solid border-outline-variant/30 px-5 py-3"
    >
      <h2 class="truncate text-base font-semibold">{{ t("messages.title") }}</h2>
      <SButton
        variant="text"
        size="small"
        :loading="message.loading"
        :disabled="message.totalUnread === 0"
        :title="t('messages.markAllRead')"
        @click="markAllRead"
      >
        <template #icon><IconLucideCheckCheck /></template>
        {{ t("messages.markAllRead") }}
      </SButton>
    </header>
    <PrivateConversation
      v-if="currentThread && user.profile"
      :user="currentThread"
      :current-user-id="user.profile.userId"
      @back="closeThread"
      @navigate="emit('navigate')"
      @sent="loadPrivate(true)"
    />

    <div v-else class="relative flex min-h-0 flex-1 flex-col px-5 pb-4 pt-3">
      <STabs
        :model-value="activeTab"
        :tabs="tabs"
        type="segment"
        size="medium"
        round
        :indicator-animated="!resizing"
        class="mb-3 shrink-0"
        @update:model-value="selectCategory"
        @reselect="refreshSelectedCategory"
      />

      <div
        ref="listScrollRef"
        class="min-h-0 flex-1 overflow-y-auto pr-1"
        @scroll.passive="handleListScroll"
      >
        <template v-if="activeTab === 'private'">
          <div
            v-if="loading.private && privateThreads.length === 0"
            class="flex h-full items-center justify-center"
          >
            <div class="text-center text-on-surface-variant/60">
              <SLoading class="mx-auto mb-3 block text-3xl text-primary/70" />
              <div class="text-sm">{{ t("messages.loading") }}</div>
            </div>
          </div>
          <div
            v-else-if="errors.private && privateThreads.length === 0"
            class="flex h-full items-center justify-center"
          >
            <div class="flex flex-col items-center gap-3 text-center">
              <p class="max-w-sm text-sm text-on-surface-variant">{{ errors.private }}</p>
              <SButton variant="secondary" size="small" @click="loadPrivate(true)">
                {{ t("common.retry") }}
              </SButton>
            </div>
          </div>
          <div
            v-else-if="privateThreads.length === 0"
            class="flex h-full items-center justify-center"
          >
            <div class="text-center text-on-surface-variant/55">
              <IconLucideInbox class="mx-auto mb-3 size-12 opacity-40" />
              <div class="text-sm">{{ t("messages.emptyPrivate") }}</div>
            </div>
          </div>
          <div v-else class="divide-y divide-outline-variant/25">
            <div
              v-for="thread in privateThreads"
              :key="thread.id"
              role="button"
              tabindex="0"
              class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3 outline-none transition-colors duration-200 hover:bg-on-surface/5 focus-visible:ring-2 focus-visible:ring-primary/35"
              @click="openThread(thread.user)"
              @keydown.enter="openThread(thread.user)"
            >
              <MessageAvatar :user="thread.user" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <span class="truncate text-sm font-medium text-primary">
                    {{ thread.user.nickname || t("messages.unknownUser") }}
                  </span>
                  <time class="shrink-0 text-xs tabular-nums text-on-surface-variant/50">
                    {{ formatMessageTime(thread.lastMessageTime, locale) }}
                  </time>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <p class="min-w-0 flex-1 truncate text-sm text-on-surface-variant">
                    {{
                      thread.lastMessage ||
                      (thread.lastMessageIsImage
                        ? t("messages.imageMessage")
                        : t("messages.unsupportedMessage"))
                    }}
                  </p>
                  <span
                    v-if="thread.unreadCount > 0"
                    class="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-on-primary"
                  >
                    {{ thread.unreadCount > 99 ? "99+" : thread.unreadCount }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex justify-center py-3">
              <SButton
                v-if="more.private"
                variant="text"
                size="small"
                :loading="loadingMore.private"
                @click="loadPrivate(false)"
              >
                {{ t("messages.loadMore") }}
              </SButton>
              <span v-else class="text-xs text-on-surface-variant/45">
                {{ t("common.noMore") }}
              </span>
            </div>
          </div>
        </template>

        <MessageActivityList
          v-else
          :items="activityItems[activeTab]"
          :loading="loading[activeTab]"
          :loading-more="loadingMore[activeTab]"
          :error="errors[activeTab]"
          :more="more[activeTab]"
          @retry="loadActivity(activeTab, true)"
          @load-more="loadActivity(activeTab, false)"
        />
      </div>

      <Transition name="fade">
        <div
          v-if="canScrollToTop"
          class="absolute bottom-5 right-8 z-20 rounded-full border border-solid border-primary/10 bg-surface-panel shadow-lg backdrop-blur-2xl backdrop-saturate-150"
        >
          <SButton
            type="primary"
            variant="bordered"
            circle
            :size="36"
            :title="t('messages.backToTop')"
            :aria-label="t('messages.backToTop')"
            @click="scrollListToTop"
          >
            <template #icon><IconLucideArrowUp class="size-4" /></template>
          </SButton>
        </div>
      </Transition>
    </div>
  </div>
</template>
