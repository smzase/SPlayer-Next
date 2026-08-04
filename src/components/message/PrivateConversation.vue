<script setup lang="ts">
import {
  fetchPrivateHistory,
  revokePrivateMessage,
  sendPrivateImage,
  sendPrivateText,
} from "@/apis/message/netease";
import { songsByIds } from "@/apis/song/netease";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import { toast } from "@/composables/useToast";
import * as player from "@/core/player";
import { useMessageStore } from "@/stores/message";
import type {
  MessageImage,
  MessageResource,
  MessageSendShortcut,
  MessageUser,
  PrivateChatMessage,
} from "@/types/message";
import { formatMessageTime } from "@/utils/format/message-time";
import { splitMessageLinks } from "@/utils/format/message-links";
import { navigateToAlbum, navigateToPlaylist } from "@/utils/navigate";
import { openExternal } from "@/utils/url";

const props = defineProps<{
  user: MessageUser;
  currentUserId: number;
}>();

const emit = defineEmits<{
  back: [];
  navigate: [];
  sent: [];
}>();

const { t, locale } = useI18n();
const messageStore = useMessageStore();
const messages = shallowRef<PrivateChatMessage[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const refreshing = ref(false);
const sending = ref(false);
const messageActionId = ref("");
const resourceActionKey = ref("");
const error = ref("");
const draft = ref("");
const more = ref(false);
const cursor = ref(0);
const scrollRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const inputRef = ref<{ $el: HTMLElement } | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const emojiOpen = ref(false);
const followingLatest = ref(true);
const selectedImage = shallowRef<{
  file: File;
  previewUrl: string;
  width: number;
  height: number;
} | null>(null);
const previewImage = shallowRef<MessageImage | null>(null);
let requestToken = 0;
const MAX_MESSAGES = 300;
const RECENT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_CHARS = 200;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const sendShortcutOptions = computed<Array<{ value: MessageSendShortcut; label: string }>>(() => [
  { value: "enter", label: t("messages.sendByEnter") },
  { value: "ctrlEnter", label: t("messages.sendByCtrlEnter") },
]);
const sendShortcutLabel = computed(() =>
  messageStore.sendShortcut === "enter" ? t("messages.sendByEnter") : t("messages.sendByCtrlEnter"),
);
const previewImageUrl = computed(
  () => previewImage.value?.url.replace(/\?param=\d+y\d+$/, "") ?? "",
);
/**
 * 记录当前会话已展示的最新消息
 * @param items - 当前会话消息
 */
const markLatestMessageRead = (items: PrivateChatMessage[]): void => {
  let latestTime = 0;
  for (const item of items) latestTime = Math.max(latestTime, item.time);
  messageStore.markPrivateThreadRead(props.currentUserId, props.user.userId, latestTime);
};

const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😝",
  "😜",
  "🤪",
  "🤨",
  "🧐",
  "🤓",
  "😎",
  "🥸",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😞",
  "😔",
  "😟",
  "😕",
  "🙁",
  "☹️",
  "😣",
  "😖",
  "😫",
  "😩",
  "🥺",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥵",
  "🥶",
  "😱",
  "😨",
  "😰",
  "😥",
  "😓",
  "🤗",
  "🤔",
  "🫣",
  "🤭",
  "🫢",
  "🫡",
  "🤫",
  "🤥",
  "😶",
  "😐",
  "😑",
  "😬",
  "🙄",
  "😯",
  "😦",
  "😧",
  "😮",
  "😲",
  "🥱",
  "😴",
  "🤤",
  "😪",
  "😵",
  "🤐",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤒",
  "🤕",
  "👍",
  "👎",
  "👌",
  "🤌",
  "🤏",
  "✌️",
  "🤞",
  "🫰",
  "🤟",
  "🤘",
  "🤙",
  "👈",
  "👉",
  "👆",
  "👇",
  "☝️",
  "✋",
  "🤚",
  "🖐️",
  "🖖",
  "👋",
  "🤝",
  "👏",
  "🙌",
  "🫶",
  "🙏",
  "💪",
  "✍️",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "🤎",
  "💔",
  "❤️‍🔥",
  "❤️‍🩹",
  "❣️",
  "💕",
  "💞",
  "💓",
  "💗",
  "💖",
  "💘",
  "💝",
  "💟",
  "🔥",
  "✨",
  "⭐",
  "🌟",
  "💫",
  "🎉",
  "🎊",
  "🎵",
  "🎶",
  "🎧",
  "🌹",
  "🌸",
  "🌈",
  "☀️",
  "🌙",
  "🍀",
  "☕",
  "🍻",
  "🎂",
  "🎁",
] as const;

const mergeMessages = (
  older: PrivateChatMessage[],
  current: PrivateChatMessage[],
): PrivateChatMessage[] => {
  const seen = new Set<string>();
  return [...older, ...current].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const scrollToBottom = async (): Promise<void> => {
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (!scrollRef.value) return;
  scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  followingLatest.value = true;
};

/** 根据当前位置判断后续内容变化是否继续贴住最新消息 */
const syncFollowingLatest = (): void => {
  if (!scrollRef.value) return;
  const distance =
    scrollRef.value.scrollHeight - scrollRef.value.scrollTop - scrollRef.value.clientHeight;
  followingLatest.value = distance < 48;
};

useResizeObserver(contentRef, () => {
  if (followingLatest.value && scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  }
});

/** 保存当前会话草稿 */
const persistDraft = (): void => {
  messageStore.setDraft(props.currentUserId, props.user.userId, draft.value);
};

watchDebounced(draft, persistDraft, { debounce: 300, maxWait: 1000 });

/** 将表情插入文本域光标位置 */
const insertEmoji = async (emoji: string): Promise<void> => {
  const textarea = inputRef.value?.$el.querySelector<HTMLTextAreaElement>("textarea");
  const start = textarea?.selectionStart ?? draft.value.length;
  const end = textarea?.selectionEnd ?? start;
  const nextDraft = `${draft.value.slice(0, start)}${emoji}${draft.value.slice(end)}`;
  if (nextDraft.length > MAX_MESSAGE_CHARS) return;
  draft.value = nextDraft;
  emojiOpen.value = false;
  await nextTick();
  const nextTextarea = inputRef.value?.$el.querySelector<HTMLTextAreaElement>("textarea");
  nextTextarea?.focus();
  nextTextarea?.setSelectionRange(start + emoji.length, start + emoji.length);
};

/** 根据内容把输入框高度限制在两行到四行之间 */
const syncDraftInputHeight = (): void => {
  const textarea = inputRef.value?.$el.querySelector<HTMLTextAreaElement>("textarea");
  if (!textarea) return;
  textarea.style.height = "auto";
  const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
  const minHeight = lineHeight * 2;
  const maxHeight = lineHeight * 4;
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight));
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
};

watch(draft, () => void nextTick(syncDraftInputHeight));

/** 点击私信正文外时清除正文选区，保留右键复制和正文内调整选区的行为 */
const clearMessageTextSelection = (event: PointerEvent): void => {
  if (event.button !== 0) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const anchor = selection.anchorNode;
  const selectedElement = anchor instanceof Element ? anchor : anchor?.parentElement;
  if (!selectedElement?.closest("[data-private-message-text]")) return;

  const target = event.target;
  if (target instanceof Element && target.closest("[data-private-message-text]")) return;
  selection.removeAllRanges();
};

onMounted(() => {
  void nextTick(syncDraftInputHeight);
  document.addEventListener("pointerdown", clearMessageTextSelection, true);
});

/** 释放当前待发送图片的本地预览 */
const clearSelectedImage = (): void => {
  if (selectedImage.value) URL.revokeObjectURL(selectedImage.value.previewUrl);
  selectedImage.value = null;
};

/** 打开系统图片选择器 */
const openImagePicker = (): void => {
  fileInputRef.value?.click();
};

/** 打开私信图片预览 */
const openImagePreview = (image: MessageImage): void => {
  previewImage.value = image;
};

/** 同步图片预览弹窗状态 */
const setImagePreviewOpen = (open: boolean): void => {
  if (!open) previewImage.value = null;
};

/** 更新私信发送快捷键 */
const setSendShortcut = (value: string | number | boolean): void => {
  if (value === "enter" || value === "ctrlEnter") {
    messageStore.setSendShortcut(value);
  }
};

/** 读取并预览待发送图片 */
const selectImage = async (event: Event): Promise<void> => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    toast.error(t("messages.unsupportedImage"));
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error(t("messages.imageTooLarge"));
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();
    clearSelectedImage();
    selectedImage.value = { file, previewUrl: URL.createObjectURL(file), width, height };
  } catch {
    toast.error(t("messages.unsupportedImage"));
  }
};

/**
 * 加载会话内容
 * @param reset - 是否从最新消息重新加载
 * @param showLoading - 是否显示整页加载状态
 */
const loadConversation = async (reset: boolean, showLoading = true): Promise<void> => {
  const token = ++requestToken;
  const container = scrollRef.value;
  const previousHeight = container?.scrollHeight ?? 0;
  if (reset) {
    followingLatest.value = true;
    if (showLoading) loading.value = true;
    error.value = "";
  } else {
    loadingMore.value = true;
  }
  try {
    const limit = Math.min(
      RECENT_MESSAGE_LIMIT,
      MAX_MESSAGES - (reset ? 0 : messages.value.length),
    );
    if (limit <= 0) {
      more.value = false;
      return;
    }
    const page = await fetchPrivateHistory(
      props.user.userId,
      props.currentUserId,
      reset ? 0 : cursor.value,
      limit,
    );
    if (token !== requestToken) return;
    const pageItems = page.items.filter(
      (item) => !messageStore.isPrivateMessageHidden(props.currentUserId, item.id),
    );
    if (reset) {
      messages.value = pageItems;
    } else {
      messages.value = mergeMessages(pageItems, messages.value);
    }
    markLatestMessageRead(messages.value);
    cursor.value = page.cursor ?? cursor.value;
    more.value = page.more && messages.value.length < MAX_MESSAGES;
    await nextTick();
    if (reset) {
      await scrollToBottom();
    } else if (scrollRef.value) {
      scrollRef.value.scrollTop += scrollRef.value.scrollHeight - previousHeight;
    }
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

/** 刷新当前会话中的最新消息 */
const refreshConversation = async (): Promise<void> => {
  if (refreshing.value || loading.value || loadingMore.value || sending.value || document.hidden) {
    return;
  }
  refreshing.value = true;
  try {
    const page = await fetchPrivateHistory(
      props.user.userId,
      props.currentUserId,
      0,
      RECENT_MESSAGE_LIMIT,
    );
    const latest = page.items.filter(
      (item) => !messageStore.isPrivateMessageHidden(props.currentUserId, item.id),
    );
    const earliestTime = latest[0]?.time;
    const older =
      messages.value.length > RECENT_MESSAGE_LIMIT && earliestTime !== undefined
        ? messages.value.filter((item) => item.time < earliestTime)
        : [];
    const nextMessages = mergeMessages(older, latest).slice(-MAX_MESSAGES);
    markLatestMessageRead(nextMessages);
    const unchanged =
      nextMessages.length === messages.value.length &&
      nextMessages.every((item, index) => {
        const current = messages.value[index];
        return (
          item.id === current.id &&
          item.text === current.text &&
          item.image?.url === current.image?.url &&
          item.resource?.title === current.resource?.title
        );
      });
    if (unchanged) return;
    const shouldFollow = followingLatest.value;
    messages.value = nextMessages;
    if (shouldFollow) await scrollToBottom();
  } catch {
    // 后台刷新失败时保留当前会话内容
  } finally {
    refreshing.value = false;
  }
};

const documentVisibility = useDocumentVisibility();
const { pause: pauseConversationPolling, resume: resumeConversationPolling } = useIntervalFn(
  refreshConversation,
  3000,
  { immediate: false },
);

watch(
  documentVisibility,
  (visibility) => {
    if (visibility === "visible") {
      resumeConversationPolling();
      if (messages.value.length > 0) void refreshConversation();
    } else {
      pauseConversationPolling();
    }
  },
  { immediate: true },
);

/** 发送当前私信草稿或待发送图片 */
const send = async (): Promise<void> => {
  const text = draft.value.trim();
  const image = selectedImage.value;
  if ((!text && !image) || sending.value) return;
  sending.value = true;
  try {
    if (image) {
      await sendPrivateImage(props.user.userId, {
        name: image.file.name,
        mimeType: image.file.type,
        bytes: new Uint8Array(await image.file.arrayBuffer()),
        width: image.width,
        height: image.height,
      });
      if (text) await sendPrivateText(props.user.userId, text);
    } else {
      await sendPrivateText(props.user.userId, text);
    }
    draft.value = "";
    messageStore.setDraft(props.currentUserId, props.user.userId, "");
    clearSelectedImage();
    emit("sent");
    await loadConversation(true, false);
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    sending.value = false;
  }
};

/** 根据当前偏好处理输入框回车键 */
const handleComposerKeydown = (event: KeyboardEvent): void => {
  if (
    event.key !== "Enter" ||
    event.isComposing ||
    event.shiftKey ||
    event.altKey ||
    event.metaKey
  ) {
    return;
  }
  const shouldSend = messageStore.sendShortcut === "enter" ? !event.ctrlKey : event.ctrlKey;
  if (!shouldSend) return;
  event.preventDefault();
  void send();
};

/**
 * 打开私信资源卡片
 * @param resource - 私信中的网易云资源摘要
 */
const openMessageResource = async (resource: MessageResource): Promise<void> => {
  if (!resource.kind || !resource.id) return;
  if (resource.kind === "album") {
    navigateToAlbum(resource.title, { source: "netease", albumId: resource.id });
    emit("navigate");
    return;
  }
  if (resource.kind === "playlist") {
    navigateToPlaylist(resource.id, { source: "netease", name: resource.title });
    emit("navigate");
    return;
  }

  const actionKey = `${resource.kind}:${resource.id}`;
  if (resourceActionKey.value) return;
  resourceActionKey.value = actionKey;
  try {
    const tracks = await songsByIds([resource.id]);
    const track = tracks.find((item) => item.id === resource.id) ?? tracks[0];
    if (!track) {
      toast.error(t("messages.resourceUnavailable"));
      return;
    }
    await player.playNow(track);
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : t("messages.resourceUnavailable"));
  } finally {
    if (resourceActionKey.value === actionKey) resourceActionKey.value = "";
  }
};

/** 生成单条私信的右键菜单 */
const messageMenuItems = (item: PrivateChatMessage): DropdownMenuItem[] => [
  { key: "copy", label: t("messages.copy") },
  { key: "delete", label: t("messages.delete") },
  ...(item.mine
    ? [
        {
          key: "revoke",
          label: t("messages.revoke"),
          separator: true,
          disabled: messageActionId.value === item.id,
        },
      ]
    : []),
];

/**
 * 处理单条私信的右键操作
 * @param action - 菜单操作
 * @param item - 目标私信
 */
const handleMessageAction = async (action: string, item: PrivateChatMessage): Promise<void> => {
  if (action === "copy") {
    const content = item.text || item.image?.url || item.resource?.title || "";
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
    return;
  }

  if (action === "delete") {
    messageStore.hidePrivateMessage(props.currentUserId, item.id);
    messages.value = messages.value.filter((message) => message.id !== item.id);
    return;
  }

  if (action !== "revoke" || !item.mine || messageActionId.value) return;
  messageActionId.value = item.id;
  try {
    await revokePrivateMessage(item.id);
    messageStore.hidePrivateMessage(props.currentUserId, item.id);
    messages.value = messages.value.filter((message) => message.id !== item.id);
    emit("sent");
    toast.success(t("messages.revokeDone"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    messageActionId.value = "";
  }
};

watch(
  () => [props.currentUserId, props.user.userId] as const,
  (ids, previousIds) => {
    if (previousIds) messageStore.setDraft(previousIds[0], previousIds[1], draft.value);
    requestToken += 1;
    messages.value = [];
    cursor.value = 0;
    more.value = false;
    draft.value = messageStore.getDraft(ids[0], ids[1]).slice(0, MAX_MESSAGE_CHARS);
    clearSelectedImage();
    void loadConversation(true);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", clearMessageTextSelection, true);
  pauseConversationPolling();
  requestToken += 1;
  persistDraft();
  clearSelectedImage();
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header
      class="flex shrink-0 items-center gap-3 border-b border-solid border-outline-variant/30 px-5 py-3"
    >
      <SButton
        variant="ghost"
        size="small"
        circle
        :title="t('messages.backToList')"
        :aria-label="t('messages.backToList')"
        @click="emit('back')"
      >
        <template #icon><IconLucideArrowLeft /></template>
      </SButton>
      <MessageAvatar :user="user" size="small" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold">
          {{ user.nickname || t("messages.unknownUser") }}
        </div>
        <div class="text-xs text-on-surface-variant/55">
          {{ t("messages.privateConversation") }}
        </div>
      </div>
    </header>

    <div
      ref="scrollRef"
      class="min-h-0 flex-1 overflow-y-auto px-5 py-4"
      @scroll.passive="syncFollowingLatest"
    >
      <div ref="contentRef" class="flex min-h-full flex-col">
        <div v-if="more" class="mb-4 flex justify-center">
          <SButton
            variant="text"
            size="small"
            :loading="loadingMore"
            @click="loadConversation(false)"
          >
            {{ t("messages.loadEarlier") }}
          </SButton>
        </div>

        <div v-if="loading" class="flex flex-1 items-center justify-center">
          <SLoading class="text-3xl text-primary/70" />
        </div>
        <div
          v-else-if="error && messages.length === 0"
          class="flex flex-1 items-center justify-center"
        >
          <div class="flex flex-col items-center gap-3 text-center">
            <p class="max-w-sm text-sm text-on-surface-variant">{{ error }}</p>
            <SButton variant="secondary" size="small" @click="loadConversation(true)">
              {{ t("common.retry") }}
            </SButton>
          </div>
        </div>
        <div v-else-if="messages.length === 0" class="flex flex-1 items-center justify-center">
          <div class="text-center text-on-surface-variant/50">
            <IconLucideMessagesSquare class="mx-auto mb-3 size-12 opacity-40" />
            <div class="text-sm">{{ t("messages.noConversation") }}</div>
          </div>
        </div>
        <div v-else class="flex flex-col gap-4">
          <SContextMenu
            v-for="item in messages"
            :key="item.id"
            :items="messageMenuItems(item)"
            @select="handleMessageAction($event, item)"
          >
            <div :class="['flex items-start gap-2', item.mine ? 'justify-end' : 'justify-start']">
              <MessageAvatar v-if="!item.mine" :user="user" size="small" />
              <div :class="['max-w-[72%]', item.mine && 'text-right']">
                <div
                  :class="[
                    'inline-block rounded-xl px-3.5 py-2.5 text-left text-sm leading-6',
                    item.mine
                      ? 'rounded-br-sm bg-primary/16 text-on-surface'
                      : 'rounded-tl-sm bg-on-surface/7 text-on-surface',
                  ]"
                >
                  <p
                    v-if="item.text"
                    data-private-message-text
                    class="cursor-text select-text whitespace-pre-wrap break-words"
                  >
                    <template
                      v-for="(part, partIndex) in splitMessageLinks(item.text)"
                      :key="`${item.id}-${partIndex}`"
                    >
                      <a
                        v-if="part.type === 'link'"
                        :href="part.value"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="select-text break-all text-primary underline decoration-primary/35 underline-offset-2 transition-colors hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        @click.prevent.stop="openExternal(part.value)"
                      >
                        {{ part.value }}
                      </a>
                      <span v-else class="select-text">{{ part.value }}</span>
                    </template>
                  </p>
                  <button
                    v-if="item.image"
                    type="button"
                    class="mt-1 block max-w-full cursor-zoom-in overflow-hidden rounded-lg border-0 bg-transparent p-0 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
                    :title="t('messages.imagePreview')"
                    :aria-label="t('messages.imagePreview')"
                    @click="openImagePreview(item.image)"
                  >
                    <img
                      :src="item.image.url"
                      :alt="t('messages.imageMessage')"
                      class="block max-h-72 max-w-full object-contain"
                      decoding="async"
                      referrerpolicy="no-referrer"
                    />
                  </button>
                  <p
                    v-if="!item.text && !item.image && !item.resource"
                    class="text-on-surface-variant"
                  >
                    {{ t("messages.unsupportedMessage") }}
                  </p>
                  <button
                    v-if="item.resource"
                    type="button"
                    :disabled="
                      !item.resource.kind ||
                      !item.resource.id ||
                      (item.resource.kind === 'song' && !!resourceActionKey)
                    "
                    :class="[
                      'mt-2 flex w-56 max-w-full items-center gap-2 rounded-lg border-0 bg-surface/65 p-2 text-left text-on-surface outline-none',
                      item.resource.kind && item.resource.id
                        ? 'cursor-pointer transition-colors hover:bg-on-surface/10 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait'
                        : 'cursor-default',
                    ]"
                    @click.stop="openMessageResource(item.resource)"
                  >
                    <img
                      v-if="item.resource.imageUrl"
                      :src="item.resource.imageUrl"
                      alt=""
                      class="size-11 shrink-0 rounded-md object-cover"
                      decoding="async"
                      referrerpolicy="no-referrer"
                    />
                    <IconLucideMusic2 v-else class="mx-2 size-5 shrink-0 text-primary/70" />
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-medium">{{ item.resource.title }}</div>
                      <div
                        v-if="item.resource.subtitle"
                        class="mt-0.5 truncate text-xs text-on-surface-variant"
                      >
                        {{ item.resource.subtitle }}
                      </div>
                    </div>
                    <SLoading
                      v-if="resourceActionKey === `${item.resource.kind}:${item.resource.id}`"
                      class="size-4 shrink-0 text-primary"
                    />
                  </button>
                </div>
                <div
                  class="mt-0.5 px-1 text-[11px] leading-4 tabular-nums text-on-surface-variant/45"
                >
                  {{ formatMessageTime(item.time, locale) }}
                </div>
              </div>
            </div>
          </SContextMenu>
        </div>
      </div>
    </div>

    <footer class="shrink-0 border-t border-solid border-outline-variant/30 px-5 py-3">
      <div v-if="selectedImage" class="mb-2 flex items-center gap-3 rounded-lg bg-on-surface/5 p-2">
        <img
          :src="selectedImage.previewUrl"
          :alt="t('messages.imageMessage')"
          class="size-14 shrink-0 rounded-md object-cover"
          decoding="async"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-medium">{{ selectedImage.file.name }}</div>
          <div class="mt-0.5 text-[11px] text-on-surface-variant/55">
            {{ selectedImage.width }} × {{ selectedImage.height }}
          </div>
        </div>
        <SButton
          variant="ghost"
          size="small"
          circle
          :title="t('messages.removeImage')"
          :aria-label="t('messages.removeImage')"
          :disabled="sending"
          @click="clearSelectedImage"
        >
          <template #icon><IconLucideX /></template>
        </SButton>
      </div>

      <div class="relative" @keydown="handleComposerKeydown">
        <SInput
          ref="inputRef"
          v-model="draft"
          type="textarea"
          :rows="2"
          :maxlength="MAX_MESSAGE_CHARS"
          :placeholder="t('messages.inputPlaceholder')"
          class="private-message-input w-full"
          :disabled="sending"
        />
        <span
          class="pointer-events-none absolute bottom-1.5 right-3 text-[10px] tabular-nums text-on-surface-variant/45"
          :title="t('messages.characterCount', { current: draft.length, max: MAX_MESSAGE_CHARS })"
        >
          {{ draft.length }}/{{ MAX_MESSAGE_CHARS }}
        </span>
      </div>
      <div class="mt-2 flex items-center gap-1.5">
        <SPopover v-model:open="emojiOpen" side="top" align="start" :side-offset="8">
          <template #trigger>
            <SButton
              variant="ghost"
              size="small"
              circle
              :title="t('messages.emoji')"
              :aria-label="t('messages.emoji')"
              :disabled="sending"
            >
              <template #icon><IconLucideSmilePlus /></template>
            </SButton>
          </template>
          <div class="grid max-h-64 w-72 grid-cols-9 gap-1 overflow-y-auto pr-1">
            <button
              v-for="emoji in EMOJIS"
              :key="emoji"
              type="button"
              class="emoji-picker-button flex size-7 cursor-pointer items-center justify-center rounded-md text-lg focus-visible:ring-2 focus-visible:ring-primary/40"
              :aria-label="emoji"
              @click="insertEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </SPopover>
        <SButton
          variant="ghost"
          size="small"
          circle
          :title="t('messages.uploadImage')"
          :aria-label="t('messages.uploadImage')"
          :disabled="sending"
          @click="openImagePicker"
        >
          <template #icon><IconLucideImagePlus /></template>
        </SButton>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="hidden"
          @change="selectImage"
        />
        <p class="min-w-0 flex-1 truncate text-[11px] text-on-surface-variant/45">
          {{ sendShortcutLabel }}
        </p>
        <div class="flex shrink-0 items-stretch">
          <SButton
            :class="[
              'message-send-main',
              !sending && !draft.trim() && !selectedImage && 'message-send-main-empty',
            ]"
            type="primary"
            size="small"
            :title="sendShortcutLabel"
            :loading="sending"
            :disabled="!draft.trim() && !selectedImage"
            @click="send"
          >
            <template #icon><IconLucideSend /></template>
            {{ t("messages.send") }}
          </SButton>
          <SPopselect
            :model-value="messageStore.sendShortcut"
            :options="sendShortcutOptions"
            :disabled="sending"
            side="top"
            align="end"
            :side-offset="6"
            :min-width="230"
            @update:model-value="setSendShortcut"
          >
            <template #trigger>
              <SButton
                class="message-send-toggle"
                type="primary"
                size="small"
                :title="t('messages.sendShortcut')"
                :aria-label="t('messages.sendShortcut')"
                :disabled="sending"
              >
                <template #icon><IconLucideChevronUp /></template>
              </SButton>
            </template>
          </SPopselect>
        </div>
      </div>
    </footer>
  </div>

  <SDialog
    :open="previewImage !== null"
    :title="t('messages.imagePreview')"
    width="min(92vw, 1120px)"
    height="min(86vh, 840px)"
    :content-style="{ padding: 0, overflow: 'hidden' }"
    destroy-on-close
    @update:open="setImagePreviewOpen"
  >
    <div class="flex size-full min-h-0 items-center justify-center bg-black/80 p-4">
      <img
        v-if="previewImage"
        :src="previewImageUrl"
        :alt="t('messages.imageMessage')"
        class="max-h-full max-w-full object-contain"
        decoding="async"
        draggable="false"
        referrerpolicy="no-referrer"
      />
    </div>
  </SDialog>
</template>

<style scoped>
.emoji-picker-button {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  line-height: 1;
  transition:
    color 150ms,
    background-color 150ms,
    transform 150ms;
}

.emoji-picker-button:hover {
  background-color: rgb(var(--s-on-surface) / 0.12);
  transform: scale(1.12);
}

.emoji-picker-button:active {
  background-color: rgb(var(--s-primary) / 0.18);
  transform: scale(0.9);
}

.private-message-input {
  padding-bottom: 1.25rem;
}

.message-send-main {
  border-bottom-right-radius: 0;
  border-top-right-radius: 0;
}

.message-send-main-empty:disabled {
  color: rgb(var(--s-on-primary) / 0.42);
  opacity: 1;
}

.message-send-toggle {
  border-bottom-left-radius: 0;
  border-top-left-radius: 0;
  box-shadow: inset 1px 0 rgb(var(--s-on-primary) / 0.24);
  padding-left: 0.45rem;
  padding-right: 0.45rem;
}
</style>
