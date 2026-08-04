<script setup lang="ts">
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import type { FollowComment } from "@/types/follow";
import { deleteFollowComment } from "@/apis/follow/netease";
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
}>();

const { t } = useI18n();
const router = useRouter();
const { copy } = useCopyText();
const deleting = ref(false);
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
</script>

<template>
  <div>
    <SContextMenu :items="menuItems" @select="handleMenu">
      <SCard size="small" radius="lg" class="select-text">
        <div class="flex gap-3">
          <button
            type="button"
            class="size-9 shrink-0 overflow-hidden rounded-full border-0 bg-on-surface/8 p-0"
            @click="openUser"
          >
            <SImg v-if="comment.user.avatar" :src="comment.user.avatar" class="size-full" />
            <IconLucideUserRound v-else class="m-auto size-4 text-on-surface-variant/45" />
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <div>
                <button
                  type="button"
                  class="border-0 bg-transparent p-0 text-sm font-medium text-on-surface transition-colors hover:text-primary"
                  @click="openUser"
                >
                  {{ comment.user.name }}
                </button>
                <div class="mt-0.5 text-xs text-on-surface-variant/40">{{ createdAt }}</div>
              </div>
              <div
                v-if="comment.likeCount"
                class="flex items-center gap-1 text-xs text-on-surface-variant/45"
              >
                <IconLucideThumbsUp class="size-3.5" />
                {{ comment.likeCount }}
              </div>
            </div>
            <FollowRichText class="mt-2" :text="comment.text" />
            <div
              v-if="comment.replyTo"
              class="mt-2 rounded-lg bg-on-surface/5 px-3 py-2 text-xs leading-5 text-on-surface-variant/65"
            >
              <span class="font-medium text-on-surface">@{{ comment.replyTo.userName }}：</span>
              {{ comment.replyTo.text }}
            </div>
          </div>
        </div>
      </SCard>
    </SContextMenu>
  </div>
</template>
