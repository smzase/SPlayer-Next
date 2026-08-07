<script setup lang="ts">
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import type { FollowComment } from "@/types/follow";
import ExpandableCommentContent from "@/components/comment/ExpandableCommentContent.vue";
import { deleteFollowComment, likeFollowComment } from "@/apis/follow/netease";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import { useCopyText } from "@/composables/useCopyText";
import IconLucideCopy from "~icons/lucide/copy";
import IconLucideTrash2 from "~icons/lucide/trash-2";

const props = defineProps<{
  comment: FollowComment;
  currentUserId: number;
  threadId: string;
}>();

const emit = defineEmits<{
  deleted: [commentId: string];
  liked: [commentId: string, liked: boolean];
  reply: [comment: FollowComment];
}>();

const { t } = useI18n();
const router = useRouter();
const { copy } = useCopyText();
const deleting = ref(false);
const liking = ref(false);
const liked = ref(props.comment.liked);
const likeCount = ref(props.comment.likeCount);
const own = computed(() => props.comment.user.id === props.currentUserId);
const canDelete = computed(() => own.value && !props.comment.id.startsWith("local-"));
const menuItems = computed<DropdownMenuItem[]>(() => [
  {
    key: "copy",
    label: t("follow.comment.copy"),
    icon: markRaw(IconLucideCopy),
  },
  ...(canDelete.value
    ? [
        {
          key: "delete",
          label: t("common.delete"),
          icon: markRaw(IconLucideTrash2),
          separator: true,
          disabled: deleting.value,
        },
      ]
    : []),
]);

const createdAt = computed(() =>
  props.comment.createdAt
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(props.comment.createdAt))
    : "",
);

watch(
  () => [props.comment.liked, props.comment.likeCount] as const,
  ([nextLiked, nextCount]) => {
    liked.value = nextLiked;
    likeCount.value = nextCount;
  },
);

const remove = async (): Promise<void> => {
  if (!canDelete.value || deleting.value) return;
  const confirmed = await dialog.confirm({
    title: t("follow.comment.deleteTitle"),
    content: t("follow.comment.deleteConfirm"),
    confirmText: t("common.delete"),
    type: "error",
  });
  if (!confirmed) return;
  deleting.value = true;
  try {
    await deleteFollowComment(props.threadId, props.comment.id);
    emit("deleted", props.comment.id);
    toast.success(t("follow.comment.deleteDone"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    deleting.value = false;
  }
};

const handleMenu = (key: string): void => {
  if (key === "copy") {
    void copy(props.comment.text);
  } else if (key === "delete") {
    void remove();
  }
};

const openUser = (): void => {
  router.push({ name: "user-profile", params: { uid: props.comment.user.id } });
};

const openReplyUser = (): void => {
  if (!props.comment.replyTo?.userId) return;
  router.push({ name: "user-profile", params: { uid: props.comment.replyTo.userId } });
};

const toggleLike = async (): Promise<void> => {
  if (liking.value || props.comment.id.startsWith("local-")) return;
  const previousLiked = liked.value;
  const previousCount = likeCount.value;
  liked.value = !previousLiked;
  likeCount.value = Math.max(0, previousCount + (liked.value ? 1 : -1));
  liking.value = true;
  try {
    await likeFollowComment(props.threadId, props.comment.id, liked.value);
    emit("liked", props.comment.id, liked.value);
  } catch (cause) {
    liked.value = previousLiked;
    likeCount.value = previousCount;
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    liking.value = false;
  }
};
</script>

<template>
  <div>
    <SContextMenu :items="menuItems" @select="handleMenu">
      <SCard size="small" radius="lg" class="select-text">
        <div class="flex gap-3">
          <button
            type="button"
            class="size-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-0 bg-on-surface/8 p-0"
            @click="openUser"
          >
            <SImg v-if="comment.user.avatar" :src="comment.user.avatar" class="size-full" />
            <IconLucideUserRound v-else class="m-auto size-4 text-on-surface-variant/45" />
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <button
                  type="button"
                  class="max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-sm font-medium text-on-surface transition-colors hover:text-primary"
                  @click="openUser"
                >
                  {{ comment.user.name }}
                </button>
                <div class="mt-0.5 text-xs text-on-surface-variant/40">{{ createdAt }}</div>
              </div>
              <div class="flex shrink-0 select-none items-center gap-0.5">
                <span
                  v-if="likeCount"
                  class="mr-0.5 text-xs tabular-nums text-on-surface-variant/55"
                >
                  {{ likeCount }}
                </span>
                <SButton
                  variant="ghost"
                  circle
                  size="small"
                  :class="liked ? 'text-primary' : 'text-on-surface-variant/55'"
                  :loading="liking"
                  :disabled="comment.id.startsWith('local-')"
                  :title="t(liked ? 'comments.actions.unlike' : 'comments.actions.like')"
                  @click="toggleLike"
                >
                  <template #icon><IconLucideThumbsUp /></template>
                </SButton>
                <SButton
                  variant="ghost"
                  circle
                  size="small"
                  :title="t('comments.actions.reply')"
                  @click="emit('reply', comment)"
                >
                  <template #icon><IconLucideReply /></template>
                </SButton>
              </div>
            </div>
            <ExpandableCommentContent class="mt-2" :content-key="comment.text">
              <FollowRichText class="m-0" :text="comment.text" />
            </ExpandableCommentContent>
            <ExpandableCommentContent
              v-if="comment.replyTo"
              :content-key="comment.replyTo.text"
              :line-height="20"
              compact
              class="mt-2 rounded-lg bg-on-surface/5 px-3 py-2 text-xs leading-5 text-on-surface-variant/65"
            >
              <button
                v-if="comment.replyTo.userId"
                type="button"
                class="cursor-pointer border-0 bg-transparent p-0 font-medium text-primary select-text hover:underline"
                @click="openReplyUser"
              >
                @{{ comment.replyTo.userName }}：
              </button>
              <FollowRichText
                v-else
                class="inline text-xs leading-5 text-on-surface-variant/65"
                :text="`@${comment.replyTo.userName}：`"
              />
              <FollowRichText
                class="m-0 inline text-xs leading-5 text-on-surface-variant/65"
                :text="comment.replyTo.text"
              />
            </ExpandableCommentContent>
          </div>
        </div>
      </SCard>
    </SContextMenu>
  </div>
</template>
