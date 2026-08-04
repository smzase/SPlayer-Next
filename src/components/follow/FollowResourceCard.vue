<script setup lang="ts">
import type { FollowResource } from "@/types/follow";
import { songsByIds } from "@/apis/song/netease";
import * as player from "@/core/player";
import {
  navigateToAlbum,
  navigateToArtist,
  navigateToPlaylist,
  navigateToPodcast,
} from "@/utils/navigate";
import { toast } from "@/composables/useToast";

const props = defineProps<{
  resource: FollowResource;
  removable?: boolean;
}>();

const emit = defineEmits<{
  remove: [];
}>();

const { t } = useI18n();
const loading = ref(false);

const resourceLabel = computed(() => t(`follow.resource.${props.resource.kind}`));

const open = async (): Promise<void> => {
  const resource = props.resource;
  if (resource.kind === "artist") {
    navigateToArtist(resource.title, { source: "netease", artistId: resource.id });
    return;
  }
  if (resource.kind === "album") {
    navigateToAlbum(resource.title, { source: "netease", albumId: resource.id });
    return;
  }
  if (resource.kind === "playlist") {
    navigateToPlaylist(resource.id, { source: "netease", name: resource.title });
    return;
  }
  if (resource.kind === "podcast") {
    navigateToPodcast(resource.id, resource.title);
    return;
  }

  if (loading.value) return;
  loading.value = true;
  try {
    const tracks = await songsByIds([resource.id]);
    const track = tracks.find((item) => item.id === resource.id) ?? tracks[0];
    if (!track) throw new Error(t("follow.resource.unavailable"));
    await player.playNow(track);
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : t("follow.resource.unavailable"));
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div
    class="group relative flex w-full items-center gap-3 rounded-xl border border-solid border-on-surface/8 bg-on-surface/4 p-2.5 text-left transition-colors duration-200"
    :class="
      removable
        ? ''
        : 'cursor-pointer hover:bg-on-surface/8 focus-visible:outline-2 focus-visible:outline-primary/45'
    "
    :role="removable ? undefined : 'button'"
    :tabindex="removable ? undefined : 0"
    @click.stop="!removable && open()"
    @keydown.enter.prevent="!removable && open()"
    @keydown.space.prevent="!removable && open()"
  >
    <div
      class="relative flex size-13 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-on-surface/8 text-on-surface-variant/40"
    >
      <SImg
        v-if="resource.cover"
        :src="resource.cover"
        :alt="resource.title"
        class="size-full object-cover"
      />
      <IconLucideMusic2 v-else class="size-5" />
      <div
        v-if="resource.kind === 'song'"
        class="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        <SLoading v-if="loading" class="text-white" />
        <IconLucidePlay v-else class="size-5 fill-white text-white" />
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <div class="mb-1 text-xs font-medium text-primary">{{ resourceLabel }}</div>
      <div class="truncate text-sm font-medium text-on-surface">{{ resource.title }}</div>
      <div v-if="resource.subtitle" class="mt-0.5 truncate text-xs text-on-surface-variant/55">
        {{ resource.subtitle }}
      </div>
    </div>
    <SButton
      v-if="removable"
      variant="ghost"
      circle
      size="small"
      class="shrink-0"
      :title="t('common.remove')"
      @click.stop="emit('remove')"
    >
      <template #icon><IconLucideX /></template>
    </SButton>
    <IconLucideChevronRight v-else class="size-4 shrink-0 text-on-surface-variant/30" />
  </div>
</template>
