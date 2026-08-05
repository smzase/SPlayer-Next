<script setup lang="ts">
import { loadCommentDraft, removeCommentDraft, saveCommentDraft } from "@/utils/commentDraft";

const props = defineProps<{
  open: boolean;
  userId: number;
  submitting: boolean;
  draftKey: string;
  replyTo?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [content: string];
}>();

const { t } = useI18n();
const text = ref("");
const exitConfirmOpen = ref(false);
const openedDraftKey = ref("");
const dirty = computed(() => !!text.value.trim());

const title = computed(() =>
  props.replyTo
    ? t("comments.editor.replyTitle", { name: props.replyTo })
    : t("comments.editor.title"),
);

const close = (): void => {
  if (props.submitting || exitConfirmOpen.value) return;
  if (dirty.value) {
    exitConfirmOpen.value = true;
    return;
  }
  removeCommentDraft(openedDraftKey.value);
  text.value = "";
  emit("update:open", false);
};

const cancelExit = (): void => {
  exitConfirmOpen.value = false;
};

const keepAndClose = (): void => {
  saveCommentDraft(openedDraftKey.value, text.value);
  exitConfirmOpen.value = false;
  emit("update:open", false);
};

const discardAndClose = (): void => {
  removeCommentDraft(openedDraftKey.value);
  text.value = "";
  exitConfirmOpen.value = false;
  emit("update:open", false);
};

const handleOpenChange = (open: boolean): void => {
  if (!open) close();
};

const submit = (): void => {
  const content = text.value.trim();
  if (!content || props.submitting) return;
  emit("submit", content);
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      openedDraftKey.value = props.draftKey;
      text.value = loadCommentDraft(openedDraftKey.value);
      exitConfirmOpen.value = false;
    } else if (props.submitting) {
      removeCommentDraft(openedDraftKey.value);
      text.value = "";
    }
  },
  { immediate: true },
);
</script>

<template>
  <SDialog
    :open="open"
    :title="title"
    width="min(620px, 92vw)"
    :closable="!submitting"
    @update:open="handleOpenChange"
  >
    <FollowTextComposer
      v-model="text"
      :user-id="userId"
      :placeholder="
        replyTo
          ? t('comments.editor.replyPlaceholder', { name: replyTo })
          : t('comments.editor.placeholder')
      "
      :maxlength="1000"
      :rows="5"
      :disabled="submitting"
      show-emoji
    />

    <template #footer>
      <SButton variant="secondary" :disabled="submitting" @click="close">
        {{ t("common.cancel") }}
      </SButton>
      <SButton type="primary" :disabled="!text.trim()" :loading="submitting" @click="submit">
        {{ replyTo ? t("comments.actions.reply") : t("comments.editor.submit") }}
      </SButton>
    </template>
  </SDialog>

  <SDialog
    :open="exitConfirmOpen"
    :title="t('follow.publish.exitTitle')"
    :closable="false"
    width="420px"
    @update:open="(value) => !value && cancelExit()"
  >
    <p class="m-0 text-sm whitespace-pre-line text-on-surface-variant">
      {{ t("comments.editor.exitConfirm") }}
    </p>
    <template #footer>
      <SButton variant="secondary" @click="cancelExit">{{ t("common.cancel") }}</SButton>
      <SButton @click="keepAndClose">{{ t("follow.publish.keep") }}</SButton>
      <SButton type="warning" @click="discardAndClose">
        {{ t("follow.publish.exit") }}
      </SButton>
    </template>
  </SDialog>
</template>
