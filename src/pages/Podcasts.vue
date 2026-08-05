<script setup lang="ts">
import type { CoverItem } from "@/types/artist";
import type { Podcast } from "@/types/podcast";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import { useUserStore } from "@/stores/user";
import { podcastToCoverItem } from "@/utils/format/podcast";
import { navigateToPodcast } from "@/utils/navigate";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import { useResourceCardMenu, type ResourceCardType } from "@/composables/useResourceCardMenu";
import CoverList from "@/components/list/CoverList.vue";
import CoverBatchToolbar from "@/components/list/CoverBatchToolbar.vue";
import IconLucideExternalLink from "~icons/lucide/external-link";
import IconLucideListChecks from "~icons/lucide/list-checks";
import IconLucidePodcast from "~icons/lucide/podcast";
import IconLucideRefreshCw from "~icons/lucide/refresh-cw";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const user = useUserStore();

type PodcastTab = "created" | "subscribed";
const batchActive = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const batchRemoving = ref(false);

const exitBatch = (): void => {
  batchActive.value = false;
  selectedIds.value = new Set();
};

const activeTab = computed<PodcastTab>(() =>
  route.query.tab === "subscribed" ? "subscribed" : "created",
);

const tabs = computed(() => [
  { key: "created", label: t("podcasts.tabs.created") },
  { key: "subscribed", label: t("podcasts.tabs.subscribed") },
]);

const onTabSwitch = (key: string): void => {
  exitBatch();
  router.replace({ query: { ...route.query, tab: key } });
};

/** 播客摘要补充声音数量 */
const toCoverItem = (podcast: Podcast): CoverItem => {
  const item = podcastToCoverItem(podcast);
  return {
    ...item,
    subtitle: [podcast.creator, t("common.totalVoices", { count: podcast.programCount })]
      .filter(Boolean)
      .join(" · "),
  };
};

const createdItems = computed<CoverItem[]>(() => user.createdPodcasts.map(toCoverItem));
const subscribedItems = computed<CoverItem[]>(() => user.subscribedPodcasts.map(toCoverItem));
const currentItems = computed(() =>
  activeTab.value === "created" ? createdItems.value : subscribedItems.value,
);
const resourceType = computed<ResourceCardType>(() => "radio");
const resourceMenu = useResourceCardMenu(resourceType);
const batchMenuItems = computed<DropdownMenuItem[]>(() => [
  {
    key: "batchManage",
    label: t("songList.batch.manage"),
    icon: markRaw(IconLucideListChecks),
  },
]);

const error = ref("");
const managerOpening = ref(false);
const refreshing = ref(false);

const enterBatch = (): void => {
  if (activeTab.value !== "subscribed" || subscribedItems.value.length === 0) return;
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
  const allSelected = subscribedItems.value.every((item) => selectedIds.value.has(item.id));
  selectedIds.value = allSelected
    ? new Set()
    : new Set(subscribedItems.value.map((item) => item.id));
};

const invertSelection = (): void => {
  selectedIds.value = new Set(
    subscribedItems.value.filter((item) => !selectedIds.value.has(item.id)).map((item) => item.id),
  );
};

const requestBatchUnsubscribe = async (): Promise<void> => {
  if (batchRemoving.value || activeTab.value !== "subscribed") return;
  const items = subscribedItems.value.filter((item) => selectedIds.value.has(item.id));
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
      await user.togglePodcastSubscribe(item.id, false);
      successCount += 1;
    } catch {
      failedIds.push(item.id);
    }
  }
  batchRemoving.value = false;

  if (activeTab.value === "subscribed") {
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

/** 按需加载个人播客 */
const loadPodcasts = async (): Promise<void> => {
  error.value = "";
  try {
    await user.ensurePodcasts();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
};

/** 从服务器刷新创建和收藏的播客 */
const refreshPodcasts = async (): Promise<void> => {
  if (refreshing.value || !user.isLoggedIn) return;
  refreshing.value = true;
  try {
    await user.refreshPodcasts();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t("common.refreshFailed"));
  } finally {
    refreshing.value = false;
  }
};

watch(
  () => user.profile?.userId,
  (uid) => {
    if (uid) void loadPodcasts();
  },
  { immediate: true },
);

const openPodcast = (item: CoverItem): void => {
  navigateToPodcast(item.id, item.title);
};

/** 使用应用登录态在系统浏览器打开网易云播客管理页 */
const openPodcastManager = async (): Promise<void> => {
  if (managerOpening.value) return;
  const userId = user.profile?.userId;
  if (!userId) {
    toast.error(t("podcasts.manageFailed"));
    return;
  }
  managerOpening.value = true;
  try {
    const result = await window.api.apis.openPodcastManager(userId);
    if (!result.ok) toast.error(t("podcasts.manageFailed"));
  } finally {
    managerOpening.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 px-5 pb-2">
      <div class="flex items-center justify-between gap-4 mt-2 mb-4">
        <div class="flex items-baseline gap-4 min-w-0">
          <h1 class="text-3xl font-bold text-on-surface shrink-0 text-balance">
            {{ t("podcasts.title") }}
          </h1>
          <Transition name="fade" mode="out-in">
            <span
              v-if="user.isLoggedIn"
              :key="activeTab"
              class="text-sm text-on-surface-variant/50 truncate"
            >
              {{ t("common.totalPodcasts", { count: currentItems.length }) }}
            </span>
          </Transition>
        </div>
        <SButton
          v-if="user.isLoggedIn && activeTab === 'created'"
          variant="secondary"
          round
          :loading="managerOpening"
          @click="openPodcastManager"
        >
          <template #icon>
            <IconLucideExternalLink />
          </template>
          {{ t("podcasts.manage") }}
        </SButton>
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
            @click="refreshPodcasts"
          >
            <template #icon><IconLucideRefreshCw /></template>
          </SButton>
          <SDropdownMenu
            v-if="activeTab === 'subscribed' && subscribedItems.length > 0"
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

    <div v-if="!user.isLoggedIn" class="flex-1 flex items-center justify-center">
      <div class="text-center text-on-surface-variant/60">
        <IconLucidePodcast class="size-12 mx-auto mb-3 opacity-30" />
        <div class="text-sm">{{ t("podcasts.notLogin") }}</div>
      </div>
    </div>
    <div v-else-if="error" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center text-red-500/85">
        <IconLucideTriangleAlert class="size-12 mx-auto mb-3 opacity-50" />
        <div class="text-sm">{{ error }}</div>
      </div>
    </div>
    <div
      v-else-if="user.podcastsLoading && !user.podcastsLoaded"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-center text-on-surface-variant/60">
        <SLoading class="text-4xl text-primary/70 mb-4 mx-auto block" />
        <div class="text-sm">{{ t("common.loading") }}</div>
      </div>
    </div>
    <Transition v-else name="fade" mode="out-in" :duration="150">
      <div v-if="currentItems.length > 0" :key="activeTab" class="flex min-h-0 flex-1 flex-col">
        <CoverBatchToolbar
          v-if="batchActive && activeTab === 'subscribed'"
          :selected-count="selectedIds.size"
          :all-selected="
            subscribedItems.length > 0 && subscribedItems.every((item) => selectedIds.has(item.id))
          "
          :indeterminate="
            selectedIds.size > 0 && !subscribedItems.every((item) => selectedIds.has(item.id))
          "
          :remove-label="t('resourceBatch.unsubscribe')"
          :download-label="t('resourceMenu.downloadAll')"
          :removing="batchRemoving"
          :downloading="resourceMenu.downloading.value"
          :download-disabled="resourceMenu.downloadDisabled.value"
          @toggle-all="toggleAll"
          @invert="invertSelection"
          @download="
            resourceMenu.downloadResources(
              subscribedItems.filter((item) => selectedIds.has(item.id)),
            )
          "
          @remove="requestBatchUnsubscribe"
          @exit="exitBatch"
        />
        <div class="min-h-0 flex-1">
          <CoverList
            :items="currentItems"
            :padding-x="20"
            :padding-top="8"
            :padding-bottom="20"
            :context-menu-items="resourceMenu.menuItems.value"
            :selection-mode="batchActive && activeTab === 'subscribed'"
            :selected-ids="selectedIds"
            shrink-on-sidebar-hover
            @click="openPodcast"
            @context-menu="resourceMenu.handleSelect"
            @toggle-selection="toggleSelection"
          />
        </div>
      </div>
      <div v-else key="empty" class="flex-1 flex items-center justify-center">
        <div class="text-center text-on-surface-variant/50">
          <IconLucidePodcast class="size-12 mx-auto mb-3 opacity-30" />
          <div class="text-sm">{{ t("podcasts.empty") }}</div>
        </div>
      </div>
    </Transition>
  </div>
</template>
