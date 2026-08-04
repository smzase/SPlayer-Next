<script setup lang="ts">
import type { Track } from "@shared/types/player";
import type { CoverItem } from "@/types/artist";
import type { FollowResource, FollowResourceKind } from "@/types/follow";
import {
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchPodcasts,
  searchSongs,
} from "@/apis/search";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [resource: FollowResource];
}>();

const { t } = useI18n();
const activeKind = ref<FollowResourceKind>("song");
const keyword = ref("");
const loading = ref(false);
const searched = ref(false);
const error = ref("");
const results = shallowRef<FollowResource[]>([]);
let requestToken = 0;

const tabs = computed(() =>
  (["song", "artist", "album", "playlist", "podcast"] as const).map((kind) => ({
    key: kind,
    label: t(`follow.resource.${kind}`),
  })),
);

const trackToResource = (track: Track): FollowResource => ({
  kind: "song",
  id: track.id,
  title: track.title,
  subtitle: track.artists.map((artist) => artist.name).join(" / "),
  cover: track.cover,
});

const coverToResource = (item: CoverItem, kind: FollowResourceKind): FollowResource => ({
  kind,
  id: item.id,
  title: item.title,
  subtitle: item.subtitle,
  cover: item.cover,
});

const search = async (): Promise<void> => {
  const value = keyword.value.trim();
  if (!value || loading.value) return;
  const token = ++requestToken;
  loading.value = true;
  searched.value = true;
  error.value = "";
  try {
    const kind = activeKind.value;
    const response =
      kind === "song"
        ? await searchSongs("netease", value, 0, 30)
        : kind === "artist"
          ? await searchArtists("netease", value, 0, 30)
          : kind === "album"
            ? await searchAlbums("netease", value, 0, 30)
            : kind === "playlist"
              ? await searchPlaylists("netease", value, 0, 30)
              : await searchPodcasts("netease", value, 0, 30);
    if (token !== requestToken) return;
    results.value =
      kind === "song"
        ? (response.items as Track[]).map(trackToResource)
        : (response.items as CoverItem[]).map((item) => coverToResource(item, kind));
  } catch (cause) {
    if (token !== requestToken) return;
    results.value = [];
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (token === requestToken) loading.value = false;
  }
};

watch(activeKind, () => {
  results.value = [];
  searched.value = false;
  error.value = "";
  if (keyword.value.trim()) void search();
});

watch(
  () => props.open,
  (open) => {
    if (!open) {
      requestToken += 1;
      loading.value = false;
    }
  },
);

const select = (resource: FollowResource): void => {
  emit("select", resource);
  emit("update:open", false);
};
</script>

<template>
  <SDialog
    :open="open"
    :title="t('follow.publish.selectResource')"
    width="min(640px, 90vw)"
    height="min(590px, 82vh)"
    @update:open="emit('update:open', $event)"
  >
    <div class="flex h-full min-h-0 flex-col px-5 pb-4">
      <STabs v-model="activeKind" :tabs="tabs" type="bar" />
      <div class="mt-3 flex shrink-0 gap-2">
        <SInput
          v-model="keyword"
          class="min-w-0 flex-1"
          :placeholder="t('follow.publish.searchResource')"
          clearable
          @keydown.enter="search"
        >
          <template #prefix>
            <IconLucideSearch class="size-4 text-on-surface-variant/45" />
          </template>
        </SInput>
        <SButton type="primary" :loading="loading" :disabled="!keyword.trim()" @click="search">
          {{ t("common.search") }}
        </SButton>
      </div>

      <div class="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <div
          v-if="loading && results.length === 0"
          class="flex h-full items-center justify-center gap-2 text-sm text-on-surface-variant/55"
        >
          <SLoading />
          {{ t("common.loading") }}
        </div>
        <div
          v-else-if="error"
          class="flex h-full items-center justify-center px-6 text-center text-sm text-red-500/85"
        >
          {{ error }}
        </div>
        <div
          v-else-if="searched && results.length === 0"
          class="flex h-full items-center justify-center text-sm text-on-surface-variant/45"
        >
          {{ t("search.noResults") }}
        </div>
        <div
          v-else-if="!searched"
          class="flex h-full flex-col items-center justify-center gap-2 text-on-surface-variant/40"
        >
          <IconLucideMusic2 class="size-10 opacity-40" />
          <span class="text-sm">{{ t("follow.publish.searchHint") }}</span>
        </div>
        <div v-else class="grid grid-cols-2 gap-2">
          <button
            v-for="item in results"
            :key="`${item.kind}:${item.id}`"
            type="button"
            class="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-solid border-on-surface/8 bg-on-surface/3 p-2 text-left transition-colors duration-200 hover:bg-on-surface/8"
            @click="select(item)"
          >
            <SImg
              v-if="item.cover"
              :src="item.cover"
              :alt="item.title"
              class="size-11 shrink-0 rounded-lg"
            />
            <div
              v-else
              class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-on-surface/8"
            >
              <IconLucideMusic2 class="size-4 text-on-surface-variant/40" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-on-surface">{{ item.title }}</div>
              <div class="mt-0.5 truncate text-xs text-on-surface-variant/50">
                {{ item.subtitle || t(`follow.resource.${item.kind}`) }}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </SDialog>
</template>
