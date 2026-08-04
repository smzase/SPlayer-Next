<script setup lang="ts">
import type { FollowComment, FollowPost } from "@/types/follow";
import {
  addFollowComment,
  deleteFollowPost,
  fetchFollowComments,
  fetchFollowPost,
} from "@/apis/follow/netease";
import { useUserStore } from "@/stores/user";
import { useFloatingPlayerBar } from "@/composables/useFloatingPlayerBar";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { isFloatingBar } = useFloatingPlayerBar();
const post = shallowRef<FollowPost | null>(null);
const comments = shallowRef<FollowComment[]>([]);
const loading = ref(true);
const error = ref("");
const commentsLoading = ref(false);
const commentsMore = ref(false);
const commentText = ref("");
const sendingComment = ref(false);
const forwardOpen = ref(false);
const composerRef = ref<HTMLElement | null>(null);
let requestToken = 0;

const currentUserId = computed(() => userStore.profile?.userId ?? 0);
const postId = computed(() => String(route.params.id ?? ""));
const postUserId = computed(() => Number(route.params.uid));

const loadComments = async (append = false): Promise<void> => {
  if (!post.value || commentsLoading.value) return;
  commentsLoading.value = true;
  try {
    const page = await fetchFollowComments(post.value.threadId, append ? comments.value.length : 0);
    comments.value = append ? [...comments.value, ...page.items] : page.items;
    commentsMore.value = page.more;
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    commentsLoading.value = false;
  }
};

const load = async (): Promise<void> => {
  if (!postId.value || !postUserId.value || !currentUserId.value) return;
  const token = ++requestToken;
  loading.value = true;
  error.value = "";
  comments.value = [];
  try {
    post.value = await fetchFollowPost(postId.value, postUserId.value, currentUserId.value);
    if (token !== requestToken) return;
    await loadComments();
  } catch (cause) {
    if (token === requestToken)
      error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (token === requestToken) loading.value = false;
  }
};

watch([postId, postUserId, currentUserId], () => void load(), { immediate: true });

const focusComment = (): void => {
  composerRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
  void nextTick(() => composerRef.value?.querySelector("textarea")?.focus());
};

const submitComment = async (): Promise<void> => {
  const content = commentText.value.trim();
  if (!post.value || !content || sendingComment.value) return;
  sendingComment.value = true;
  try {
    const comment = await addFollowComment(post.value.threadId, content);
    commentText.value = "";
    post.value = { ...post.value, commentCount: post.value.commentCount + 1 };
    if (comment) {
      comments.value = [comment, ...comments.value.filter((item) => item.id !== comment.id)];
    } else {
      await loadComments();
    }
    toast.success(t("follow.comment.done"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    sendingComment.value = false;
  }
};

const updateLiked = (_postId: string, liked: boolean): void => {
  if (!post.value) return;
  post.value = {
    ...post.value,
    liked,
    likeCount: Math.max(0, post.value.likeCount + (liked ? 1 : -1)),
  };
};

const updateForwarded = (): void => {
  if (post.value) post.value = { ...post.value, shareCount: post.value.shareCount + 1 };
};

const removeComment = (commentId: string): void => {
  comments.value = comments.value.filter((comment) => comment.id !== commentId);
  if (post.value) {
    post.value = {
      ...post.value,
      commentCount: Math.max(0, post.value.commentCount - 1),
    };
  }
};

const removePost = async (): Promise<void> => {
  if (!post.value) return;
  const confirmed = await dialog.confirm({
    title: t("follow.delete.title"),
    content: t("follow.delete.confirm"),
    confirmText: t("follow.action.delete"),
    type: "error",
  });
  if (!confirmed) return;
  try {
    await deleteFollowPost(post.value.id);
    toast.success(t("follow.delete.done"));
    await router.replace({ name: "follow" });
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  }
};
</script>

<template>
  <div class="h-full">
    <div class="h-full overflow-y-auto">
      <div
        class="mx-auto flex max-w-[900px] flex-col px-6 pt-5"
        :class="isFloatingBar ? 'pb-28' : 'pb-10'"
      >
        <header class="mb-4 flex items-center gap-3">
          <SButton variant="ghost" circle :title="t('common.back')" @click="router.back()">
            <template #icon><IconLucideArrowLeft /></template>
          </SButton>
          <div>
            <h1 class="text-xl font-semibold text-on-surface">{{ t("follow.detail.title") }}</h1>
            <p class="mt-0.5 text-xs text-on-surface-variant/50">
              {{ t("follow.detail.subtitle") }}
            </p>
          </div>
        </header>

        <div
          v-if="loading"
          class="flex min-h-90 items-center justify-center gap-2 text-sm text-on-surface-variant/55"
        >
          <SLoading />
          {{ t("common.loading") }}
        </div>
        <div
          v-else-if="error || !post"
          class="flex min-h-90 flex-col items-center justify-center gap-3"
        >
          <IconLucideTriangleAlert class="size-12 text-red-500/55" />
          <div class="max-w-md text-center text-sm text-on-surface-variant">{{ error }}</div>
          <SButton variant="secondary" @click="load">{{ t("common.retry") }}</SButton>
        </div>
        <template v-else>
          <FollowPostCard
            :post="post"
            detail
            @comment="focusComment"
            @forward="forwardOpen = true"
            @delete="removePost"
            @liked="updateLiked"
          />

          <section class="mt-5">
            <h2 class="mb-3 text-lg font-semibold text-on-surface">
              {{ t("follow.comment.title", { count: post.commentCount }) }}
            </h2>
            <div ref="composerRef">
              <FollowTextComposer
                v-model="commentText"
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
                  :disabled="!commentText.trim()"
                  :loading="sendingComment"
                  @click="submitComment"
                >
                  {{ t("follow.comment.submit") }}
                </SButton>
              </div>
            </div>

            <div
              v-if="commentsLoading && !comments.length"
              class="flex items-center justify-center gap-2 py-12 text-sm text-on-surface-variant/50"
            >
              <SLoading />
              {{ t("common.loading") }}
            </div>
            <div
              v-else-if="!comments.length"
              class="py-12 text-center text-sm text-on-surface-variant/45"
            >
              {{ t("follow.comment.empty") }}
            </div>
            <div v-else class="mt-5 space-y-2">
              <FollowCommentCard
                v-for="comment in comments"
                :key="comment.id"
                :comment="comment"
                :current-user-id="currentUserId"
                :thread-id="post.threadId"
                @deleted="removeComment"
              />
              <div class="flex justify-center py-3">
                <SButton
                  v-if="commentsMore"
                  variant="ghost"
                  :loading="commentsLoading"
                  @click="loadComments(true)"
                >
                  {{ t("follow.comment.loadMore") }}
                </SButton>
              </div>
            </div>
          </section>
        </template>
      </div>
    </div>

    <FollowForwardDialog
      v-if="post"
      v-model:open="forwardOpen"
      :post="post"
      :user-id="currentUserId"
      @forwarded="updateForwarded"
    />
  </div>
</template>
