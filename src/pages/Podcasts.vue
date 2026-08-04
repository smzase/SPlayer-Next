<script setup lang="ts">
import type { CoverItem } from "@/types/artist";
import type { Podcast } from "@/types/podcast";
import { useUserStore } from "@/stores/user";
import { podcastToCoverItem } from "@/utils/format/podcast";
import { navigateToPodcast } from "@/utils/navigate";
import { toast } from "@/composables/useToast";
import CoverList from "@/components/list/CoverList.vue";
import IconLucideExternalLink from "~icons/lucide/external-link";
import IconLucidePodcast from "~icons/lucide/podcast";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const user = useUserStore();

type PodcastTab = "created" | "subscribed";

const activeTab = computed<PodcastTab>(() =>
  route.query.tab === "subscribed" ? "subscribed" : "created",
);

const tabs = computed(() => [
  { key: "created", label: t("podcasts.tabs.created") },
  { key: "subscribed", label: t("podcasts.tabs.subscribed") },
]);

const onTabSwitch = (key: string): void => {
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

const error = ref("");
const managerOpening = ref(false);

/** 按需加载个人播客 */
const loadPodcasts = async (): Promise<void> => {
  error.value = "";
  try {
    await user.ensurePodcasts();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
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

/** 使用应用登录态打开网易云播客管理页 */
const openPodcastManager = async (): Promise<void> => {
  if (managerOpening.value) return;
  managerOpening.value = true;
  try {
    const result = await window.api.apis.openPodcastManager();
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
      <STabs :model-value="activeTab" :tabs="tabs" @update:model-value="onTabSwitch" />
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
      <div v-if="currentItems.length > 0" :key="activeTab" class="flex-1 min-h-0">
        <CoverList
          :items="currentItems"
          :padding-x="20"
          :padding-top="8"
          :padding-bottom="20"
          @click="openPodcast"
        />
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
