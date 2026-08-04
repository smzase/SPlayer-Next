<script setup lang="ts">
import type { FollowPost } from "@/types/follow";
import { forwardFollowPost } from "@/apis/follow/netease";
import { toast } from "@/composables/useToast";

const props = defineProps<{
  open: boolean;
  post: FollowPost | null;
  userId: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  forwarded: [postId: string];
}>();

const { t } = useI18n();
const text = ref("");
const sending = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open) text.value = "";
  },
);

const submit = async (): Promise<void> => {
  if (!props.post || sending.value) return;
  sending.value = true;
  try {
    await forwardFollowPost(props.post.id, props.post.user.id, text.value.trim());
    toast.success(t("follow.forward.done"));
    emit("forwarded", props.post.id);
    emit("update:open", false);
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <SDialog
    :open="open"
    :title="t('follow.forward.title')"
    width="min(540px, 90vw)"
    @update:open="emit('update:open', $event)"
  >
    <div class="pb-1">
      <FollowTextComposer
        v-model="text"
        :user-id="userId"
        :placeholder="t('follow.forward.placeholder')"
        :maxlength="500"
        :rows="3"
        :disabled="sending"
        show-emoji
      />
      <div
        v-if="post"
        class="mt-3 rounded-xl border border-solid border-on-surface/8 bg-on-surface/4 px-3 py-2.5"
      >
        <div class="mb-1 text-xs font-medium text-on-surface-variant/60">@{{ post.user.name }}</div>
        <div class="line-clamp-2 text-sm leading-5 text-on-surface-variant">
          {{ post.text || post.resource?.title }}
        </div>
      </div>
    </div>
    <template #footer>
      <SButton variant="secondary" :disabled="sending" @click="emit('update:open', false)">
        {{ t("common.cancel") }}
      </SButton>
      <SButton type="primary" :loading="sending" @click="submit">
        {{ t("follow.forward.submit") }}
      </SButton>
    </template>
  </SDialog>
</template>
