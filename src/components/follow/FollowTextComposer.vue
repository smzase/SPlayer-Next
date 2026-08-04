<script setup lang="ts">
import type { FollowUser } from "@/types/follow";
import { fetchMentionUsers, searchMentionUsers } from "@/apis/follow/netease";
import { toast } from "@/composables/useToast";
import SEmojiPicker from "@/components/ui/SEmojiPicker.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    userId: number;
    placeholder: string;
    maxlength?: number;
    rows?: number;
    disabled?: boolean;
    showEmoji?: boolean;
  }>(),
  {
    maxlength: 1000,
    rows: 4,
    disabled: false,
    showEmoji: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();
const inputRef = ref<{ $el: HTMLElement } | null>(null);
const mentionOpen = ref(false);
const emojiOpen = ref(false);
const mentionKeyword = ref("");
const followedUsers = shallowRef<FollowUser[]>([]);
const searchedUsers = shallowRef<FollowUser[]>([]);
const followedUsersLoading = ref(false);
const searchedUsersLoading = ref(false);
const visibleUsers = computed(() =>
  mentionKeyword.value.trim() ? searchedUsers.value : followedUsers.value,
);
const usersLoading = computed(() =>
  mentionKeyword.value.trim() ? searchedUsersLoading.value : followedUsersLoading.value,
);
let usersLoaded = false;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchToken = 0;

const setValue = (value: string): void => {
  emit("update:modelValue", value.slice(0, props.maxlength));
};

const insertAtCursor = async (value: string, selection?: [number, number]): Promise<void> => {
  const textarea = inputRef.value?.$el.querySelector<HTMLTextAreaElement>("textarea");
  const start = textarea?.selectionStart ?? props.modelValue.length;
  const end = textarea?.selectionEnd ?? start;
  const next = `${props.modelValue.slice(0, start)}${value}${props.modelValue.slice(end)}`;
  if (next.length > props.maxlength) return;
  setValue(next);
  await nextTick();
  const nextTextarea = inputRef.value?.$el.querySelector<HTMLTextAreaElement>("textarea");
  nextTextarea?.focus();
  const range = selection ?? [start + value.length, start + value.length];
  nextTextarea?.setSelectionRange(range[0], range[1]);
};

const insertTopic = (): void => {
  const textarea = inputRef.value?.$el.querySelector<HTMLTextAreaElement>("textarea");
  const cursor = textarea?.selectionStart ?? props.modelValue.length;
  const prefix = cursor > 0 && !/\s/.test(props.modelValue[cursor - 1]) ? " " : "";
  const start = cursor + prefix.length + 1;
  void insertAtCursor(`${prefix}#话题# `, [start, start + 2]);
};

const loadUsers = async (): Promise<void> => {
  if (usersLoaded || followedUsersLoading.value) return;
  followedUsersLoading.value = true;
  try {
    followedUsers.value = await fetchMentionUsers(props.userId);
    usersLoaded = true;
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    followedUsersLoading.value = false;
  }
};

watch(mentionOpen, (open) => {
  if (open) {
    void loadUsers();
    return;
  }
  mentionKeyword.value = "";
});

watch(mentionKeyword, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }
  const keyword = value.trim();
  const token = ++searchToken;
  if (!keyword) {
    searchedUsers.value = [];
    searchedUsersLoading.value = false;
    return;
  }
  searchedUsersLoading.value = true;
  searchTimer = setTimeout(async () => {
    searchTimer = undefined;
    try {
      const users = await searchMentionUsers(keyword);
      if (token === searchToken) searchedUsers.value = users;
    } catch (cause) {
      if (token === searchToken) {
        searchedUsers.value = [];
        toast.error(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (token === searchToken) searchedUsersLoading.value = false;
    }
  }, 300);
});

const insertMention = (user: FollowUser): void => {
  const textarea = inputRef.value?.$el.querySelector<HTMLTextAreaElement>("textarea");
  const cursor = textarea?.selectionStart ?? props.modelValue.length;
  const prefix = cursor > 0 && !/\s/.test(props.modelValue[cursor - 1]) ? " " : "";
  void insertAtCursor(`${prefix}@${user.name} `);
  mentionOpen.value = false;
};

const insertEmoji = (emoji: string): void => {
  void insertAtCursor(emoji);
};

onBeforeUnmount(() => {
  searchToken += 1;
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="rounded-xl border border-solid border-on-surface/10 bg-on-surface/3">
    <SInput
      ref="inputRef"
      :model-value="modelValue"
      type="textarea"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :disabled="disabled"
      class="border-0! bg-transparent! shadow-none! ring-0!"
      @update:model-value="setValue"
    />
    <div class="flex items-center gap-1 px-2 pt-0.5 pb-1.5">
      <SButton
        variant="ghost"
        circle
        size="small"
        :disabled="disabled"
        :title="t('follow.composer.topic')"
        @click="insertTopic"
      >
        <template #icon><IconLucideHash /></template>
      </SButton>
      <SPopover v-model:open="mentionOpen" side="top" align="start" content-class="w-72 p-1!">
        <template #trigger>
          <SButton
            variant="ghost"
            circle
            size="small"
            :disabled="disabled"
            :title="t('follow.composer.mention')"
          >
            <template #icon><IconLucideAtSign /></template>
          </SButton>
        </template>
        <div class="p-1">
          <SInput
            v-model="mentionKeyword"
            :placeholder="t('follow.composer.searchUsers')"
            clearable
            @keydown.stop
          >
            <template #prefix>
              <IconLucideSearch class="size-4 text-on-surface-variant/40" />
            </template>
          </SInput>
        </div>
        <div class="max-h-56 overflow-y-auto p-1">
          <div
            v-if="usersLoading"
            class="flex items-center justify-center gap-2 py-5 text-xs text-on-surface-variant/50"
          >
            <SLoading />
            {{ t("common.loading") }}
          </div>
          <div
            v-else-if="visibleUsers.length === 0"
            class="py-5 text-center text-xs text-on-surface-variant/50"
          >
            {{
              t(mentionKeyword.trim() ? "follow.composer.noUsers" : "follow.composer.noMentions")
            }}
          </div>
          <button
            v-for="user in visibleUsers"
            v-else
            :key="user.id"
            type="button"
            class="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-on-surface hover:bg-on-surface/8"
            @click="insertMention(user)"
          >
            <SImg v-if="user.avatar" :src="user.avatar" class="size-7 rounded-full" />
            <div v-else class="size-7 rounded-full bg-on-surface/8" />
            <span class="min-w-0 flex-1 truncate text-sm">{{ user.name }}</span>
          </button>
        </div>
      </SPopover>
      <SEmojiPicker
        v-if="showEmoji"
        v-model:open="emojiOpen"
        :disabled="disabled"
        :title="t('follow.composer.emoji')"
        @select="insertEmoji"
      />
      <slot name="tools" />
      <span class="ml-auto px-1 text-xs tabular-nums text-on-surface-variant/40">
        {{ modelValue.length }}/{{ maxlength }}
      </span>
    </div>
  </div>
</template>
