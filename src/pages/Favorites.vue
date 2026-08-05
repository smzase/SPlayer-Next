<script setup lang="ts">
import type { CoverItem } from "@/types/artist";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import { useUserStore } from "@/stores/user";
import { useResourceCardMenu, type ResourceCardType } from "@/composables/useResourceCardMenu";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import {
  albumsToCoverItems,
  artistsToCoverItems,
  playlistToCoverItem,
} from "@/utils/format/coverItem";
import CoverList from "@/components/list/CoverList.vue";
import CoverBatchToolbar from "@/components/list/CoverBatchToolbar.vue";
import IconLucideListMusic from "~icons/lucide/list-music";
import IconLucideListChecks from "~icons/lucide/list-checks";
import IconLucideDisc3 from "~icons/lucide/disc-3";
import IconLucideUser from "~icons/lucide/user";
import IconLucideRefreshCw from "~icons/lucide/refresh-cw";
import IconMaterialSymbolsFavoriteOutline from "~icons/material-symbols/favorite-outline-rounded";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const user = useUserStore();

type FavTab = "playlist" | "album" | "artist";

const TAB_KEYS: readonly FavTab[] = ["playlist", "album", "artist"];
const batchActive = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const batchRemoving = ref(false);

const exitBatch = (): void => {
  batchActive.value = false;
  selectedIds.value = new Set();
};

/** 当前 tab */
const activeTab = computed<FavTab>(() => {
  const tab = route.query.tab;
  return typeof tab === "string" && (TAB_KEYS as readonly string[]).includes(tab)
    ? (tab as FavTab)
    : "playlist";
});

const onTabSwitch = (key: string): void => {
  exitBatch();
  router.replace({ query: { ...route.query, tab: key } });
};

const tabs = computed(() => [
  { key: "playlist" satisfies FavTab, label: t("favorites.tabs.playlist") },
  { key: "album" satisfies FavTab, label: t("favorites.tabs.album") },
  { key: "artist" satisfies FavTab, label: t("favorites.tabs.artist") },
]);

const playlistItems = computed<CoverItem[]>(() =>
  user.subscribedPlaylists.map((pl) => ({
    ...playlistToCoverItem(pl),
    subtitle: pl.trackCount ? t("common.totalSongs", { count: pl.trackCount }) : "",
  })),
);

const albumItems = computed<CoverItem[]>(() => albumsToCoverItems(user.albums));

const artistItems = computed<CoverItem[]>(() => artistsToCoverItems(user.artists));

const currentItems = computed<CoverItem[]>(() => {
  if (activeTab.value === "playlist") return playlistItems.value;
  if (activeTab.value === "album") return albumItems.value;
  return artistItems.value;
});
const resourceType = computed<ResourceCardType>(() => activeTab.value);
const resourceMenu = useResourceCardMenu(resourceType);
const refreshing = ref(false);

const batchMenuItems = computed<DropdownMenuItem[]>(() => [
  {
    key: "batchManage",
    label: t("songList.batch.manage"),
    icon: markRaw(IconLucideListChecks),
  },
]);

const enterBatch = (): void => {
  if (currentItems.value.length === 0) return;
  batchActive.value = true;
  selectedIds.value = new Set();
};

const toggleSelection = (item: CoverItem): void => {
  const next = new Set(selectedIds.value);
  if (next.has(item.id)) next.delete(item.id);
  else next.add(item.id);
  selectedIds.value = next;
};

const toggleAll = (): void => {
  const allSelected = currentItems.value.every((item) => selectedIds.value.has(item.id));
  selectedIds.value = allSelected ? new Set() : new Set(currentItems.value.map((item) => item.id));
};

const invertSelection = (): void => {
  selectedIds.value = new Set(
    currentItems.value.filter((item) => !selectedIds.value.has(item.id)).map((item) => item.id),
  );
};

const requestBatchUnsubscribe = async (): Promise<void> => {
  if (batchRemoving.value) return;
  const type = activeTab.value;
  const items = currentItems.value.filter((item) => selectedIds.value.has(item.id));
  if (items.length === 0) return;
  const confirmed = await dialog.confirm({
    title: t("resourceBatch.unsubscribeTitle"),
    content: t("resourceBatch.unsubscribeConfirm", { count: items.length }),
    confirmText: t("resourceBatch.unsubscribe"),
    type: "error",
  });
  if (!confirmed) return;

  batchRemoving.value = true;
  const failedIds: string[] = [];
  let successCount = 0;
  for (const item of items) {
    try {
      if (type === "playlist") await user.togglePlaylistSubscribe(item.id, false);
      else if (type === "album") await user.toggleAlbumSubscribe(item.id, false);
      else await user.toggleArtistSubscribe(item.id, false);
      successCount += 1;
    } catch {
      failedIds.push(item.id);
    }
  }
  batchRemoving.value = false;

  if (activeTab.value === type) {
    selectedIds.value = new Set(failedIds);
    if (failedIds.length === 0) exitBatch();
  }
  if (failedIds.length === 0) {
    toast.success(t("resourceBatch.unsubscribeDone", { count: successCount }));
  } else {
    toast.error(
      t("resourceBatch.unsubscribePartial", {
        success: successCount,
        failed: failedIds.length,
      }),
    );
  }
};

/** 从服务器刷新全部收藏分类 */
const refreshFavorites = async (): Promise<void> => {
  if (refreshing.value || !user.isLoggedIn) return;
  refreshing.value = true;
  try {
    await user.refreshFavorites();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t("common.refreshFailed"));
  } finally {
    refreshing.value = false;
  }
};

const countMeta = computed(() => {
  switch (activeTab.value) {
    case "album":
      return {
        icon: IconLucideDisc3,
        text: t("common.totalAlbums", { count: albumItems.value.length }),
      };
    case "artist":
      return {
        icon: IconLucideUser,
        text: t("common.totalArtists", { count: artistItems.value.length }),
      };
    case "playlist":
    default:
      return {
        icon: IconLucideListMusic,
        text: t("common.totalPlaylists", { count: playlistItems.value.length }),
      };
  }
});

const handleClick = (item: CoverItem): void => {
  if (activeTab.value === "artist") {
    router.push(`/artist/netease/${encodeURIComponent(item.id)}`);
  } else {
    router.push(`/collection/netease/${activeTab.value}/${encodeURIComponent(item.id)}`);
  }
};
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 顶栏 -->
    <div class="shrink-0 px-5 pb-2">
      <div class="flex items-baseline gap-4 mt-2 mb-4 min-w-0">
        <h1 class="text-3xl font-bold text-on-surface shrink-0 text-balance">
          {{ t("favorites.title") }}
        </h1>
        <Transition name="fade" mode="out-in">
          <span
            v-if="user.isLoggedIn"
            :key="activeTab"
            class="flex items-center gap-1.5 text-sm text-on-surface-variant/50 truncate"
          >
            <component :is="countMeta.icon" class="size-3.5 shrink-0" />
            {{ countMeta.text }}
          </span>
        </Transition>
      </div>
      <div class="flex items-center justify-between gap-3">
        <STabs :model-value="activeTab" :tabs="tabs" @update:model-value="onTabSwitch" />
        <div v-if="user.isLoggedIn" class="flex items-center gap-2">
          <SButton
            variant="text"
            circle
            :size="32"
            :icon-size="16"
            :loading="refreshing"
            :title="t('common.refresh')"
            :aria-label="t('common.refresh')"
            @click="refreshFavorites"
          >
            <template #icon><IconLucideRefreshCw /></template>
          </SButton>
          <SDropdownMenu
            v-if="currentItems.length > 0"
            :items="batchMenuItems"
            align="end"
            @select="enterBatch"
          >
            <template #trigger>
              <SButton
                variant="text"
                circle
                :size="32"
                :icon-size="16"
                :title="t('common.more')"
                :aria-label="t('common.more')"
              >
                <template #icon><IconLucideEllipsis /></template>
              </SButton>
            </template>
          </SDropdownMenu>
        </div>
      </div>
    </div>
    <!-- 未登录 -->
    <div v-if="!user.isLoggedIn" class="flex-1 flex items-center justify-center">
      <div class="text-center text-on-surface-variant/60">
        <IconMaterialSymbolsFavoriteOutline class="size-12 mx-auto mb-3 opacity-30" />
        <div class="text-sm">{{ t("favorites.notLogin") }}</div>
      </div>
    </div>
    <!-- 内容 -->
    <Transition v-else name="fade" mode="out-in" :duration="150">
      <div v-if="currentItems.length > 0" :key="activeTab" class="flex min-h-0 flex-1 flex-col">
        <CoverBatchToolbar
          v-if="batchActive"
          :selected-count="selectedIds.size"
          :all-selected="
            currentItems.length > 0 && currentItems.every((item) => selectedIds.has(item.id))
          "
          :indeterminate="
            selectedIds.size > 0 && !currentItems.every((item) => selectedIds.has(item.id))
          "
          :remove-label="t('resourceBatch.unsubscribe')"
          :download-label="activeTab !== 'artist' ? t('resourceMenu.downloadAll') : undefined"
          :removing="batchRemoving"
          :downloading="resourceMenu.downloading.value"
          :download-disabled="resourceMenu.downloadDisabled.value"
          @toggle-all="toggleAll"
          @invert="invertSelection"
          @download="
            resourceMenu.downloadResources(currentItems.filter((item) => selectedIds.has(item.id)))
          "
          @remove="requestBatchUnsubscribe"
          @exit="exitBatch"
        />
        <div class="min-h-0 flex-1">
          <CoverList
            :items="currentItems"
            :type="activeTab === 'artist' ? 'artist' : 'default'"
            :min-size="activeTab === 'artist' ? 120 : 140"
            :padding-x="20"
            :padding-top="8"
            :padding-bottom="20"
            :context-menu-items="resourceMenu.menuItems.value"
            :selection-mode="batchActive"
            :selected-ids="selectedIds"
            shrink-on-sidebar-hover
            @click="handleClick"
            @context-menu="resourceMenu.handleSelect"
            @toggle-selection="toggleSelection"
          />
        </div>
      </div>
      <div v-else key="empty" class="flex-1 flex items-center justify-center">
        <div class="text-center text-on-surface-variant/50">
          <IconMaterialSymbolsFavoriteOutline class="size-12 mx-auto mb-3 opacity-30" />
          <div class="text-sm">{{ t("favorites.empty") }}</div>
        </div>
      </div>
    </Transition>
  </div>
</template>
