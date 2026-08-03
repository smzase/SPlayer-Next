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

const VIEW_RETENTION_MS = 180_000;
const MAX_DRAFTS = 50;
const MAX_HIDDEN_PRIVATE_MESSAGES = 500;
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
    const totalUnread = computed(() =>
      Object.values(unread.value).reduce((sum, value) => sum + value, 0),
    );
    let requestToken = 0;
    let viewState: MessageViewState | null = null;

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

    /** 刷新服务器未读数量 */
    const refreshUnread = async (): Promise<void> => {
      const token = ++requestToken;
      loading.value = true;
      try {
        const next = await fetchMessageUnreadCounts();
        if (token === requestToken) unread.value = next;
      } finally {
        if (token === requestToken) loading.value = false;
      }
    };

    /**
     * 清除单个分类的本地未读标记
     * @param category - 消息分类
     */
    const markCategoryRead = (category: MessageCategory): void => {
      if (unread.value[category] === 0) return;
      unread.value = { ...unread.value, [category]: 0 };
    };

    /** 读取所有分类并同步清除未读标记 */
    const markAllRead = async (userId: number): Promise<void> => {
      loading.value = true;
      try {
        await readAllMessageCategories(userId);
        unread.value = { ...EMPTY_COUNTS };
      } finally {
        loading.value = false;
      }
    };

    /** 清理退出登录后的消息状态 */
    const clear = (): void => {
      requestToken += 1;
      unread.value = { ...EMPTY_COUNTS };
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
      totalUnread,
      setPanelSize,
      setSendShortcut,
      rememberView,
      restoreView,
      getDraft,
      setDraft,
      isPrivateMessageHidden,
      hidePrivateMessage,
      refreshUnread,
      markCategoryRead,
      markAllRead,
      clear,
    };
  },
  {
    persist: {
      storage: localStorage,
      pick: ["panelSize", "sendShortcut", "drafts", "hiddenPrivateMessages"],
    },
  },
);
