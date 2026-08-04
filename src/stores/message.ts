import { fetchMessageUnreadCounts, readAllMessageCategories } from "@/apis/message/netease";
import type {
  MessageCategory,
  MessageDraft,
  MessageSendShortcut,
  MessageUnreadCounts,
  MessageUser,
  MessageViewState,
} from "@/types/message";

const EMPTY_COUNTS: MessageUnreadCounts = {
  private: 0,
  comment: 0,
  mention: 0,
  notice: 0,
};

interface MessageReadBaseline {
  counts: MessageUnreadCounts;
  updatedAt: number;
}

const MESSAGE_CATEGORIES: readonly MessageCategory[] = ["private", "comment", "mention", "notice"];
const VIEW_RETENTION_MS = 180_000;
const MAX_DRAFTS = 50;
const MAX_HIDDEN_PRIVATE_MESSAGES = 500;
const MAX_PRIVATE_THREAD_READ_TIMES = 500;
const MAX_READ_BASELINES = 5;
const DEFAULT_PANEL_SIZE = { width: 600, height: 620 };

export const useMessageStore = defineStore(
  "message",
  () => {
    const unread = ref<MessageUnreadCounts>({ ...EMPTY_COUNTS });
    const loading = ref(false);
    const panelSize = reactive({ ...DEFAULT_PANEL_SIZE });
    const sendShortcut = ref<MessageSendShortcut>("ctrlEnter");
    const drafts = ref<Record<string, MessageDraft>>({});
    const hiddenPrivateMessages = ref<Record<string, number>>({});
    const privateThreadReadTimes = ref<Record<string, number>>({});
    const readBaselines = ref<Record<string, MessageReadBaseline>>({});
    const serverUnread = ref<MessageUnreadCounts>({ ...EMPTY_COUNTS });
    const requestedThread = shallowRef<MessageUser | null>(null);
    const totalUnread = computed(() =>
      Object.values(unread.value).reduce((sum, value) => sum + value, 0),
    );
    let requestToken = 0;
    let viewState: MessageViewState | null = null;

    /** 请求顶栏消息浮窗打开指定私信 */
    const requestPrivateThread = (thread: MessageUser): void => {
      requestedThread.value = { ...thread };
    };

    /** 消费待打开的私信请求 */
    const consumeRequestedThread = (): MessageUser | null => {
      const thread = requestedThread.value;
      requestedThread.value = null;
      return thread ? { ...thread } : null;
    };

    /**
     * 保存指定账号的服务器未读基线
     * @param userId - 当前用户 ID
     * @param counts - 已查看时的服务器未读数量
     */
    const saveReadBaseline = (userId: number, counts: MessageUnreadCounts): void => {
      const next = {
        ...readBaselines.value,
        [String(userId)]: { counts: { ...counts }, updatedAt: Date.now() },
      };
      readBaselines.value = Object.fromEntries(
        Object.entries(next)
          .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
          .slice(0, MAX_READ_BASELINES),
      );
    };

    /** 更新消息浮窗尺寸 */
    const setPanelSize = (width: number, height: number): void => {
      panelSize.width = Math.round(width);
      panelSize.height = Math.round(height);
    };

    /** 更新私信输入框的发送快捷键 */
    const setSendShortcut = (shortcut: MessageSendShortcut): void => {
      sendShortcut.value = shortcut;
    };

    /** 保存关闭前的消息页面，三分钟内可恢复 */
    const rememberView = (
      category: MessageCategory,
      thread: MessageUser | null,
      scrollPositions: Readonly<Record<MessageCategory, number>>,
    ): void => {
      viewState = {
        category,
        ...(thread ? { thread: { ...thread } } : {}),
        scrollPositions: { ...scrollPositions },
        expiresAt: Date.now() + VIEW_RETENTION_MS,
      };
    };

    /** 读取仍在有效期内的消息页面 */
    const restoreView = (): MessageViewState | null => {
      if (!viewState || viewState.expiresAt <= Date.now()) {
        viewState = null;
        return null;
      }
      return {
        ...viewState,
        ...(viewState.thread ? { thread: { ...viewState.thread } } : {}),
        scrollPositions: { ...viewState.scrollPositions },
      };
    };

    /** 生成按账号隔离的私信草稿键 */
    const draftKey = (currentUserId: number, peerUserId: number): string =>
      `${currentUserId}:${peerUserId}`;

    /** 读取指定会话的长期草稿 */
    const getDraft = (currentUserId: number, peerUserId: number): string =>
      drafts.value[draftKey(currentUserId, peerUserId)]?.text ?? "";

    /** 保存指定会话草稿，并限制长期草稿数量 */
    const setDraft = (currentUserId: number, peerUserId: number, text: string): void => {
      const key = draftKey(currentUserId, peerUserId);
      const next = { ...drafts.value };
      if (text) next[key] = { text, updatedAt: Date.now() };
      else delete next[key];
      drafts.value = Object.fromEntries(
        Object.entries(next)
          .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
          .slice(0, MAX_DRAFTS),
      );
    };

    /** 生成按账号隔离的本地私信隐藏键 */
    const hiddenPrivateMessageKey = (currentUserId: number, messageId: string): string =>
      `${currentUserId}:${messageId}`;

    /**
     * 判断私信是否已在本地删除
     * @param currentUserId - 当前登录用户 ID
     * @param messageId - 私信 ID
     */
    const isPrivateMessageHidden = (currentUserId: number, messageId: string): boolean =>
      Boolean(hiddenPrivateMessages.value[hiddenPrivateMessageKey(currentUserId, messageId)]);

    /**
     * 在本地删除一条私信
     * @param currentUserId - 当前登录用户 ID
     * @param messageId - 私信 ID
     */
    const hidePrivateMessage = (currentUserId: number, messageId: string): void => {
      const key = hiddenPrivateMessageKey(currentUserId, messageId);
      const next = { ...hiddenPrivateMessages.value, [key]: Date.now() };
      hiddenPrivateMessages.value = Object.fromEntries(
        Object.entries(next)
          .sort(([, left], [, right]) => right - left)
          .slice(0, MAX_HIDDEN_PRIVATE_MESSAGES),
      );
    };

    /** 生成按账号隔离的私信会话已读键 */
    const privateThreadReadKey = (currentUserId: number, peerUserId: number): string =>
      String(currentUserId) + ":" + String(peerUserId);

    /**
     * 判断会话最新消息是否已在本地查看
     * @param currentUserId - 当前登录用户 ID
     * @param peerUserId - 对方用户 ID
     * @param latestMessageTime - 会话最新消息时间
     */
    const isPrivateThreadRead = (
      currentUserId: number,
      peerUserId: number,
      latestMessageTime: number,
    ): boolean =>
      latestMessageTime > 0 &&
      latestMessageTime <=
        (privateThreadReadTimes.value[privateThreadReadKey(currentUserId, peerUserId)] ?? 0);

    /**
     * 记录私信会话已查看到的最新消息时间
     * @param currentUserId - 当前登录用户 ID
     * @param peerUserId - 对方用户 ID
     * @param latestMessageTime - 已查看的最新消息时间
     */
    const markPrivateThreadRead = (
      currentUserId: number,
      peerUserId: number,
      latestMessageTime: number,
    ): void => {
      if (latestMessageTime <= 0) return;
      const key = privateThreadReadKey(currentUserId, peerUserId);
      if ((privateThreadReadTimes.value[key] ?? 0) >= latestMessageTime) return;
      privateThreadReadTimes.value = Object.fromEntries(
        Object.entries({
          ...privateThreadReadTimes.value,
          [key]: latestMessageTime,
        })
          .sort(([, left], [, right]) => right - left)
          .slice(0, MAX_PRIVATE_THREAD_READ_TIMES),
      );
    };

    /** 刷新服务器未读数量 */
    const refreshUnread = async (userId: number): Promise<void> => {
      const token = ++requestToken;
      loading.value = true;
      try {
        const next = await fetchMessageUnreadCounts();
        if (token !== requestToken) return;
        const baseline = {
          ...(readBaselines.value[String(userId)]?.counts ?? EMPTY_COUNTS),
        };
        let baselineChanged = false;
        const visible = { ...EMPTY_COUNTS };
        for (const category of MESSAGE_CATEGORIES) {
          if (next[category] < baseline[category]) {
            baseline[category] = 0;
            baselineChanged = true;
          }
          visible[category] = Math.max(0, next[category] - baseline[category]);
        }
        serverUnread.value = { ...next };
        unread.value = visible;
        if (baselineChanged) saveReadBaseline(userId, baseline);
      } finally {
        if (token === requestToken) loading.value = false;
      }
    };

    /**
     * 清除单个分类的本地未读标记
     * @param category - 消息分类
     */
    const markCategoryRead = (category: MessageCategory, userId: number): void => {
      const current = readBaselines.value[String(userId)]?.counts ?? EMPTY_COUNTS;
      if (current[category] !== serverUnread.value[category]) {
        saveReadBaseline(userId, {
          ...current,
          [category]: serverUnread.value[category],
        });
      }
      if (unread.value[category] !== 0) {
        unread.value = { ...unread.value, [category]: 0 };
      }
    };

    /** 读取所有分类并同步清除未读标记 */
    const markAllRead = async (userId: number): Promise<void> => {
      loading.value = true;
      try {
        await readAllMessageCategories(userId);
        saveReadBaseline(userId, serverUnread.value);
        unread.value = { ...EMPTY_COUNTS };
      } finally {
        loading.value = false;
      }
    };

    /** 清理退出登录后的消息状态 */
    const clear = (): void => {
      requestToken += 1;
      unread.value = { ...EMPTY_COUNTS };
      serverUnread.value = { ...EMPTY_COUNTS };
      requestedThread.value = null;
      loading.value = false;
      viewState = null;
    };

    return {
      unread,
      loading,
      panelSize,
      sendShortcut,
      drafts,
      hiddenPrivateMessages,
      privateThreadReadTimes,
      readBaselines,
      totalUnread,
      requestedThread,
      requestPrivateThread,
      consumeRequestedThread,
      setPanelSize,
      setSendShortcut,
      rememberView,
      restoreView,
      getDraft,
      setDraft,
      isPrivateMessageHidden,
      hidePrivateMessage,
      isPrivateThreadRead,
      markPrivateThreadRead,
      refreshUnread,
      markCategoryRead,
      markAllRead,
      clear,
    };
  },
  {
    persist: {
      storage: localStorage,
      pick: [
        "panelSize",
        "sendShortcut",
        "drafts",
        "hiddenPrivateMessages",
        "privateThreadReadTimes",
        "readBaselines",
      ],
    },
  },
);
