<script setup lang="ts">
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import type { FollowPost } from "@/types/follow";
import { likeFollowPost } from "@/apis/follow/netease";
import { toast } from "@/composables/useToast";
import { useImageActions } from "@/composables/useImageActions";
import SImagePreviewDialog from "@/components/ui/SImagePreviewDialog.vue";
import IconLucideTrash2 from "~icons/lucide/trash-2";

const props = withDefaults(
  defineProps<{
    post: FollowPost;
    detail?: boolean;
  }>(),
  {
    detail: false,
  },
);

const emit = defineEmits<{
  open: [post: FollowPost];
  forward: [post: FollowPost];
  comment: [post: FollowPost];
  delete: [post: FollowPost];
  liked: [postId: string, liked: boolean];
}>();

const { t } = useI18n();
const router = useRouter();
const { menuItems: imageMenuItems, handleAction: handleImageAction } = useImageActions();
const likeLoading = ref(false);
const localLiked = ref(props.post.liked);
const localLikeCount = ref(props.post.likeCount);
const previewImageIndex = ref<number | null>(null);
const previewImageUrls = computed(() =>
  props.post.images.map((image) => image.url.replace(/\?param=\d+y\d+$/, "")),
);

watch(
  () => [props.post.liked, props.post.likeCount] as const,
  ([liked, count]) => {
    localLiked.value = liked;
    localLikeCount.value = count;
  },
);

const menuItems = computed<DropdownMenuItem[]>(() =>
  props.post.own
    ? [{ key: "delete", label: t("follow.action.delete"), icon: markRaw(IconLucideTrash2) }]
    : [],
);

const createdAt = computed(() => {
  if (!props.post.createdAt) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(props.post.createdAt));
});

const toggleLike = async (): Promise<void> => {
  if (likeLoading.value) return;
  const next = !localLiked.value;
  const previousLiked = localLiked.value;
  const previousCount = localLikeCount.value;
  localLiked.value = next;
  localLikeCount.value = Math.max(0, previousCount + (next ? 1 : -1));
  likeLoading.value = true;
  try {
    await likeFollowPost(props.post.threadId, next);
    emit("liked", props.post.id, next);
  } catch (cause) {
    localLiked.value = previousLiked;
    localLikeCount.value = previousCount;
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    likeLoading.value = false;
  }
};

const handleMenu = (key: string): void => {
  if (key === "delete") emit("delete", props.post);
};

const openImagePreview = (index: number): void => {
  previewImageIndex.value = index;
};

const setImagePreviewOpen = (open: boolean): void => {
  if (!open) previewImageIndex.value = null;
};

const openUser = (): void => {
  router.push({ name: "user-profile", params: { uid: props.post.user.id } });
};
</script>

<template>
  <SCard radius="xl" size="large" class="overflow-hidden">
    <article>
      <header class="flex items-start gap-3">
        <button
          type="button"
          class="size-10 shrink-0 overflow-hidden rounded-full border-0 bg-on-surface/8 p-0 ring-1 ring-on-surface/10 transition-transform duration-200 hover:scale-105"
          @click="openUser"
        >
          <SImg
            v-if="post.user.avatar"
            :src="post.user.avatar"
            :alt="post.user.name"
            class="size-full"
          />
          <IconLucideUserRound v-else class="m-auto size-4 text-on-surface-variant/45" />
        </button>
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="max-w-full truncate border-0 bg-transparent p-0 text-left text-sm font-semibold text-on-surface transition-colors hover:text-primary"
            @click="openUser"
          >
            {{ post.user.name }}
          </button>
          <div class="mt-0.5 text-xs text-on-surface-variant/45">{{ createdAt }}</div>
        </div>
        <SDropdownMenu
          v-if="menuItems.length"
          :items="menuItems"
          side="bottom"
          align="end"
          @select="handleMenu"
        >
          <template #trigger>
            <SButton variant="ghost" circle size="small" :title="t('common.more')">
              <template #icon><IconLucideEllipsis /></template>
            </SButton>
          </template>
        </SDropdownMenu>
      </header>

      <div
        class="mt-3"
        :class="detail ? '' : 'cursor-pointer'"
        @click="!detail && emit('open', post)"
      >
        <FollowRichText v-if="post.text" :text="post.text" />

        <div
          v-if="post.images.length"
          class="mt-3 grid max-h-[400px] gap-1.5 overflow-hidden rounded-xl"
          :class="
            post.images.length === 1
              ? 'w-fit max-w-full grid-cols-1'
              : post.images.length <= 4
                ? 'w-full max-w-[400px] grid-cols-2'
                : 'w-full max-w-[400px] grid-cols-3'
          "
        >
          <SContextMenu
            v-for="(image, index) in post.images.slice(0, 9)"
            :key="`${image.url}-${index}`"
            :items="imageMenuItems"
            @select="handleImageAction($event, previewImageUrls[index] ?? image.url)"
          >
            <button
              type="button"
              class="relative cursor-zoom-in overflow-hidden border-0 bg-on-surface/6 p-0 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
              :class="
                post.images.length === 1 ? 'max-h-[400px] max-w-full' : 'aspect-square min-h-0'
              "
              :title="t('follow.imagePreview')"
              :aria-label="t('follow.imagePreview')"
              @click.stop="openImagePreview(index)"
            >
              <img
                :src="image.url"
                :alt="t('follow.imageAlt')"
                decoding="async"
                :class="
                  post.images.length === 1
                    ? 'block h-auto max-h-[400px] w-auto max-w-full object-contain'
                    : 'size-full object-cover'
                "
                referrerpolicy="no-referrer"
              />
              <div
                v-if="index === 8 && post.images.length > 9"
                class="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white"
              >
                +{{ post.images.length - 9 }}
              </div>
            </button>
          </SContextMenu>
        </div>

        <FollowResourceCard v-if="post.resource" :resource="post.resource" class="mt-3" />
      </div>

      <footer class="mt-3 grid grid-cols-3 items-center text-on-surface-variant/60">
        <button
          type="button"
          class="flex h-8 cursor-pointer items-center justify-center justify-self-start gap-1.5 rounded-lg border-0 bg-transparent px-3 text-xs transition-colors duration-200 hover:bg-on-surface/7 hover:text-on-surface"
          :class="localLiked ? 'text-primary' : ''"
          :disabled="likeLoading"
          @click="toggleLike"
        >
          <IconLucideThumbsUp class="size-4" :class="localLiked ? 'fill-current' : ''" />
          <span>{{ t("follow.action.like") }}</span>
          <span v-if="localLikeCount" class="tabular-nums">{{ localLikeCount }}</span>
        </button>
        <button
          type="button"
          class="flex h-8 cursor-pointer items-center justify-center justify-self-center gap-1.5 rounded-lg border-0 bg-transparent px-3 text-xs transition-colors duration-200 hover:bg-on-surface/7 hover:text-on-surface"
          @click="emit('comment', post)"
        >
          <IconLucideMessageCircle class="size-4" />
          <span>{{ t("follow.action.comment") }}</span>
          <span v-if="post.commentCount" class="tabular-nums">{{ post.commentCount }}</span>
        </button>
        <button
          type="button"
          class="flex h-8 cursor-pointer items-center justify-center justify-self-end gap-1.5 rounded-lg border-0 bg-transparent px-3 text-xs transition-colors duration-200 hover:bg-on-surface/7 hover:text-on-surface"
          @click="emit('forward', post)"
        >
          <IconLucideRepeat2 class="size-4" />
          <span>{{ t("follow.action.forward") }}</span>
          <span v-if="post.shareCount" class="tabular-nums">{{ post.shareCount }}</span>
        </button>
      </footer>

      <slot name="comment" />
    </article>
  </SCard>

  <SImagePreviewDialog
    :open="previewImageIndex !== null"
    :sources="previewImageUrls"
    :initial-index="previewImageIndex ?? 0"
    :title="t('follow.imagePreview')"
    :alt="t('follow.imageAlt')"
    @update:open="setImagePreviewOpen"
  />
</template>
