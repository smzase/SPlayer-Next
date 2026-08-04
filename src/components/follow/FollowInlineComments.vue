<script setup lang="ts">
import type { FollowComment, FollowPost } from "@/types/follow";
import { addFollowComment, fetchFollowComments } from "@/apis/follow/netease";
import { useUserStore } from "@/stores/user";
import { toast } from "@/composables/useToast";

const props = defineProps<{
  post: FollowPost;
  currentUserId: number;
}>();

const emit = defineEmits<{
  collapse: [];
  busy: [value: boolean];
  commentCountChanged: [postId: string, delta: number];
}>();

const { t } = useI18n();
const router = useRouter();
const user = useUserStore();
const rootRef = ref<HTMLElement | null>(null);
const text = ref("");
const comments = shallowRef<FollowComment[]>([]);
const loading = ref(false);
const sending = ref(false);
let requestToken = 0;
let reloadTimer: number | undefined;

/** 获取笔记最新的五条评论 */
const loadComments = async (clear = false): Promise<void> => {
  const token = ++requestToken;
  if (clear) comments.value = [];
  loading.value = true;
  try {
    const page = await fetchFollowComments(props.post.threadId, 0, 5);
    if (token === requestToken) comments.value = page.items.slice(0, 5);
  } catch (cause) {
    if (token === requestToken) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  } finally {
    if (token === requestToken) loading.value = false;
  }
};

/** 发送评论并立即同步行内评论列表 */
const submit = async (): Promise<void> => {
  const content = text.value.trim();
  if (!content || sending.value || !props.currentUserId) return;
  sending.value = true;
  emit("busy", true);
  try {
    const comment = await addFollowComment(props.post.threadId, content);
    text.value = "";
    emit("commentCountChanged", props.post.id, 1);
    if (comment) {
      comments.value = [comment, ...comments.value.filter((item) => item.id !== comment.id)].slice(
        0,
        5,
      );
    } else {
      const profile = user.profile;
      comments.value = [
        {
          id: `local-${Date.now()}`,
          user: {
            id: profile?.userId ?? props.currentUserId,
            name: profile?.nickname ?? "",
            ...(profile?.avatarUrl ? { avatar: profile.avatarUrl } : {}),
          },
          text: content,
          createdAt: Date.now(),
          liked: false,
          likeCount: 0,
        },
        ...comments.value,
      ].slice(0, 5);
      reloadTimer = window.setTimeout(() => void loadComments(), 1000);
    }
    toast.success(t("follow.comment.done"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    sending.value = false;
    emit("busy", false);
  }
};

/** 从行内列表移除已删除的评论 */
const removeComment = (commentId: string): void => {
  comments.value = comments.value.filter((comment) => comment.id !== commentId);
  emit("commentCountChanged", props.post.id, -1);
};

/** 打开笔记详情并查看完整评论 */
const openDetail = (): void => {
  router.push({
    name: "follow-detail",
    params: { uid: props.post.user.id, id: props.post.id },
  });
};

onMounted(async () => {
  void loadComments(true);
  await nextTick();
  rootRef.value?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
});

onBeforeUnmount(() => {
  requestToken += 1;
  if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
  emit("busy", false);
});
</script>

<template>
  <div ref="rootRef" class="mt-3">
    <FollowTextComposer
      v-model="text"
      :user-id="currentUserId"
      :placeholder="t('follow.comment.placeholder')"
      :maxlength="500"
      :rows="3"
      :disabled="sending || !currentUserId"
      show-emoji
    />
    <div class="mt-2 flex justify-end">
      <SButton
        type="primary"
        round
        :disabled="!text.trim() || !currentUserId"
        :loading="sending"
        @click="submit"
      >
        {{ t("follow.comment.submit") }}
      </SButton>
    </div>
    <div
      v-if="loading && !comments.length"
      class="flex items-center justify-center gap-2 py-5 text-xs text-on-surface-variant/50"
    >
      <SLoading />
      {{ t("common.loading") }}
    </div>
    <div v-else-if="!comments.length" class="py-4 text-center text-xs text-on-surface-variant/45">
      {{ t("follow.comment.empty") }}
    </div>
    <div v-else class="mt-3 space-y-2">
      <FollowCommentCard
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :current-user-id="currentUserId"
        :thread-id="post.threadId"
        @deleted="removeComment"
      />
    </div>
    <div class="relative mt-2 flex items-center justify-center">
      <SButton
        class="absolute left-0"
        variant="text"
        size="small"
        :disabled="sending"
        @click="openDetail"
      >
        {{ t("follow.comment.viewMore") }}
      </SButton>
      <SButton variant="text" size="small" :disabled="sending" @click="emit('collapse')">
        {{ t("follow.comment.collapse") }}
      </SButton>
    </div>
  </div>
</template>
