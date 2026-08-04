<script setup lang="ts">
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import type { CoverItem } from "@/types/artist";
import type { UserPageProfile, UserPageResources } from "@/types/user-profile";
import {
  fetchUserPageProfile,
  fetchUserPageResources,
  fetchUserListeningRank,
  setUserBlacklisted,
  setUserFollowed,
} from "@/apis/user-profile/netease";
import { useMessageStore } from "@/stores/message";
import { useUserStore } from "@/stores/user";
import { playlistToCoverItem } from "@/utils/format/coverItem";
import { podcastToCoverItem } from "@/utils/format/podcast";
import { navigateToPodcast } from "@/utils/navigate";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import IconLucideBan from "~icons/lucide/ban";

type MainTab = "music" | "podcast" | "notes";
type ResourceTab = "created" | "collected";

const EMPTY_RESOURCES: UserPageResources = {
  createdPlaylists: [],
  collectedPlaylists: [],
  createdPodcasts: [],
  collectedPodcasts: [],
  playlistAccess: "available",
  createdPodcastsAccess: "available",
  collectedPodcastsAccess: "private",
};
const LISTENING_RANK_ID = "__user_listening_rank__";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const user = useUserStore();
const message = useMessageStore();
const profile = shallowRef<UserPageProfile | null>(null);
const resources = shallowRef<UserPageResources>({ ...EMPTY_RESOURCES });
const listeningRankCover = ref<string>();
const loading = ref(false);
const resourcesLoading = ref(false);
const relationLoading = ref(false);
const managerOpening = ref(false);
const error = ref("");
const activeTab = ref<MainTab>("music");
const musicTab = ref<ResourceTab>("created");
const podcastTab = ref<ResourceTab>("created");
const editOpen = ref(false);
let requestToken = 0;

const uid = computed(() => Number(route.params.uid) || 0);
const own = computed(() => uid.value === user.profile?.userId);
const mainTabs = computed(() => [
  { key: "music", label: t("userProfile.tabs.music") },
  { key: "podcast", label: t("userProfile.tabs.podcast") },
  { key: "notes", label: t("userProfile.tabs.notes") },
]);
const resourceTabs = computed(() => [
  { key: "created", label: t("userProfile.created") },
  { key: "collected", label: t("userProfile.collected") },
]);

const playlistItems = computed<CoverItem[]>(() => {
  const list =
    musicTab.value === "created"
      ? resources.value.createdPlaylists
      : resources.value.collectedPlaylists;
  const items = list.map((playlist) => ({
    ...playlistToCoverItem(playlist),
    subtitle: [
      playlist.owner,
      playlist.trackCount ? t("common.totalSongs", { count: playlist.trackCount }) : "",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  if (own.value && musicTab.value === "created") {
    items.unshift({
      id: LISTENING_RANK_ID,
      title: t("userProfile.listeningRank"),
      cover: listeningRankCover.value,
      coverVariant: "listening-rank",
      subtitle: t("userProfile.listeningRankSubtitle", {
        count: profile.value?.listenSongs ?? 0,
      }),
      trackCount: 0,
    });
  }
  return items;
});

const podcastItems = computed<CoverItem[]>(() => {
  const list =
    podcastTab.value === "created"
      ? resources.value.createdPodcasts
      : resources.value.collectedPodcasts;
  return list.map((podcast) => ({
    ...podcastToCoverItem(podcast),
    subtitle: [podcast.creator, t("common.totalVoices", { count: podcast.programCount })]
      .filter(Boolean)
      .join(" · "),
  }));
});

const actionLabel = computed(() => {
  if (!profile.value) return "";
  if (profile.value.mutual) return t("userProfile.mutual");
  if (profile.value.followed) return t("userProfile.following");
  return t("userProfile.follow");
});
const activePodcastAccess = computed(() =>
  podcastTab.value === "created"
    ? resources.value.createdPodcastsAccess
    : resources.value.collectedPodcastsAccess,
);

const moreItems = computed<DropdownMenuItem[]>(() => [
  {
    key: "block",
    label: t("userProfile.block"),
    icon: markRaw(IconLucideBan),
  },
]);

const loadResources = async (token: number): Promise<void> => {
  resourcesLoading.value = true;
  try {
    const result = await fetchUserPageResources(uid.value, own.value);
    if (token === requestToken) resources.value = result;
  } catch {
    if (token === requestToken) {
      resources.value = {
        ...EMPTY_RESOURCES,
        playlistAccess: "unavailable",
        createdPodcastsAccess: "unavailable",
        collectedPodcastsAccess: own.value ? "unavailable" : "private",
      };
    }
  } finally {
    if (token === requestToken) resourcesLoading.value = false;
  }
};

/** 获取所有时间听歌排行第一名的封面 */
const loadListeningRankCover = async (token: number): Promise<void> => {
  try {
    const [topTrack] = await fetchUserListeningRank(uid.value, "all");
    if (token === requestToken) listeningRankCover.value = topTrack?.cover;
  } catch {
    if (token === requestToken) listeningRankCover.value = undefined;
  }
};

const load = async (): Promise<void> => {
  if (!uid.value) return;
  const token = ++requestToken;
  loading.value = true;
  error.value = "";
  profile.value = null;
  resources.value = { ...EMPTY_RESOURCES };
  listeningRankCover.value = undefined;
  try {
    profile.value = await fetchUserPageProfile(uid.value, user.profile?.userId);
    if (token !== requestToken) return;
    void loadResources(token);
    if (own.value) void loadListeningRankCover(token);
  } catch (cause) {
    if (token === requestToken) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    }
  } finally {
    if (token === requestToken) loading.value = false;
  }
};

watch(
  uid,
  () => {
    activeTab.value = "music";
    musicTab.value = "created";
    podcastTab.value = "created";
    void load();
  },
  { immediate: true },
);

const openConnections = (type: "follows" | "followers"): void => {
  router.push({
    name: "user-connections",
    params: { uid: uid.value },
    query: { type },
  });
};

const toggleFollow = async (): Promise<void> => {
  if (!profile.value || relationLoading.value) return;
  relationLoading.value = true;
  try {
    const followed = !profile.value.followed;
    await setUserFollowed(profile.value.userId, followed);
    profile.value = {
      ...profile.value,
      followed,
      mutual: followed && profile.value.followedBy,
      followeds: Math.max(0, profile.value.followeds + (followed ? 1 : -1)),
    };
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    relationLoading.value = false;
  }
};

const openPrivateMessage = (): void => {
  if (!profile.value) return;
  message.requestPrivateThread({
    userId: profile.value.userId,
    nickname: profile.value.nickname,
    avatarUrl: profile.value.avatarUrl,
  });
};

/** 打开该账号绑定的歌手页 */
const openArtistPage = (): void => {
  if (!profile.value?.artistId) return;
  router.push({
    name: "artist",
    params: { source: "netease", id: profile.value.artistId },
  });
};

const blockUser = async (): Promise<void> => {
  if (!profile.value || relationLoading.value) return;
  const blacklisted = !profile.value.blacklisted;
  if (blacklisted) {
    const confirmed = await dialog.confirm({
      title: t("userProfile.blockConfirmTitle"),
      content: t("userProfile.blockConfirm", { name: profile.value.nickname }),
      confirmText: t("userProfile.block"),
      type: "warning",
    });
    if (!confirmed) return;
  }
  relationLoading.value = true;
  try {
    await setUserBlacklisted(profile.value.userId, blacklisted);
    profile.value = {
      ...profile.value,
      blacklisted,
      followed: blacklisted ? false : profile.value.followed,
      mutual: blacklisted ? false : profile.value.mutual,
    };
    toast.success(blacklisted ? t("userProfile.blockDone") : t("userProfile.unblockDone"));
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    relationLoading.value = false;
  }
};

const handleMore = (key: string): void => {
  if (key === "block") void blockUser();
};

const openPlaylist = (item: CoverItem): void => {
  if (item.id === LISTENING_RANK_ID) {
    router.push({ name: "user-listening-rank", params: { uid: uid.value } });
    return;
  }
  router.push("/collection/netease/playlist/" + encodeURIComponent(item.id));
};

const openPodcast = (item: CoverItem): void => {
  navigateToPodcast(item.id, item.title);
};

/** 使用应用登录态在系统浏览器打开网易云播客管理页 */
const openPodcastManager = async (): Promise<void> => {
  if (managerOpening.value || !own.value) return;
  managerOpening.value = true;
  try {
    const result = await window.api.apis.openPodcastManager(uid.value);
    if (!result.ok) toast.error(t("podcasts.manageFailed"));
  } finally {
    managerOpening.value = false;
  }
};

const refreshAfterEdit = async (): Promise<void> => {
  await user.fetchStatus();
  await load();
};
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div
      v-if="loading"
      class="flex h-full items-center justify-center gap-2 text-sm text-on-surface-variant/55"
    >
      <SLoading />
      {{ t("common.loading") }}
    </div>
    <div
      v-else-if="error || !profile"
      class="flex h-full flex-col items-center justify-center gap-3"
    >
      <IconLucideTriangleAlert class="size-12 text-red-500/50" />
      <p class="max-w-md text-center text-sm text-on-surface-variant">
        {{ error || t("userProfile.loadFailed") }}
      </p>
      <SButton variant="secondary" @click="load">{{ t("common.retry") }}</SButton>
    </div>
    <div v-else class="mx-auto max-w-[1100px] px-6 pb-20 pt-5">
      <section class="relative overflow-hidden rounded-2xl bg-surface-alt shadow-sm">
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-on-surface/3"
        />
        <div class="relative px-6 py-6">
          <div class="flex items-end justify-between gap-4">
            <div class="flex min-w-0 items-end gap-4">
              <div
                class="size-24 shrink-0 overflow-hidden rounded-full border-4 border-surface-alt bg-on-surface/8 shadow-md"
              >
                <img
                  v-if="profile.avatarUrl"
                  :src="profile.avatarUrl"
                  :alt="profile.nickname"
                  decoding="async"
                  class="size-full object-cover"
                  referrerpolicy="no-referrer"
                />
                <IconLucideUserRound v-else class="m-auto size-9 text-on-surface-variant/45" />
              </div>
              <div class="min-w-0 pb-1">
                <div class="flex min-w-0 items-center gap-1.5">
                  <h1 class="truncate text-2xl font-bold text-on-surface">
                    {{ profile.nickname }}
                  </h1>
                  <SButton
                    v-if="own"
                    class="shrink-0"
                    variant="ghost"
                    circle
                    size="tiny"
                    :title="t('userProfile.edit.title')"
                    @click="editOpen = true"
                  >
                    <template #icon><IconLucidePencil /></template>
                  </SButton>
                </div>
                <div class="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant/55">
                  <span>{{ t("userProfile.id", { id: profile.userId }) }}</span>
                  <span
                    v-if="profile.level !== undefined"
                    class="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary"
                  >
                    Lv.{{ profile.level }}
                  </span>
                </div>
              </div>
            </div>
            <div v-if="!own || profile.artistId" class="flex shrink-0 items-center gap-2 pb-1">
              <SButton
                v-if="profile.blacklisted"
                type="primary"
                round
                :loading="relationLoading"
                @click="blockUser"
              >
                {{ t("userProfile.unblock") }}
              </SButton>
              <template v-else>
                <SButton v-if="profile.artistId" variant="secondary" round @click="openArtistPage">
                  <template #icon><IconLucideMic /></template>
                  {{ t("userProfile.artistPage") }}
                </SButton>
                <template v-if="!own">
                  <SButton
                    :type="profile.followed ? 'default' : 'primary'"
                    :variant="profile.followed ? 'secondary' : 'filled'"
                    round
                    :loading="relationLoading"
                    @click="toggleFollow"
                  >
                    <template #icon>
                      <IconLucideUserCheck v-if="profile.followed" />
                      <IconLucideUserPlus v-else />
                    </template>
                    {{ actionLabel }}
                  </SButton>
                  <SButton variant="secondary" round @click="openPrivateMessage">
                    <template #icon><IconLucideMessageCircle /></template>
                    {{ t("userProfile.privateMessage") }}
                  </SButton>
                  <SDropdownMenu :items="moreItems" @select="handleMore">
                    <template #trigger>
                      <SButton variant="secondary" circle :title="t('common.more')">
                        <template #icon><IconLucideEllipsis /></template>
                      </SButton>
                    </template>
                  </SDropdownMenu>
                </template>
              </template>
            </div>
          </div>

          <div class="mt-4">
            <ExpandableDescription
              :text="profile.signature"
              :empty-text="t('userProfile.noSignature')"
            />
          </div>
          <div class="mt-4 flex items-center gap-5 text-sm">
            <button
              type="button"
              class="border-0 bg-transparent p-0 text-on-surface-variant transition-colors hover:text-primary"
              @click="openConnections('follows')"
            >
              <strong class="mr-1 text-on-surface tabular-nums">{{ profile.follows }}</strong>
              {{ t("userProfile.follows") }}
            </button>
            <button
              type="button"
              class="border-0 bg-transparent p-0 text-on-surface-variant transition-colors hover:text-primary"
              @click="openConnections('followers')"
            >
              <strong class="mr-1 text-on-surface tabular-nums">{{ profile.followeds }}</strong>
              {{ t("userProfile.followers") }}
            </button>
            <span class="text-on-surface-variant">
              <strong class="mr-1 text-on-surface tabular-nums">{{ profile.eventCount }}</strong>
              {{ t("userProfile.notes") }}
            </span>
          </div>
        </div>
      </section>

      <div class="mt-6">
        <STabs v-model="activeTab" :tabs="mainTabs" type="bar" size="large" />
      </div>

      <section class="mt-4">
        <template v-if="activeTab === 'music'">
          <STabs v-model="musicTab" :tabs="resourceTabs" />
          <div v-if="resourcesLoading" class="flex min-h-56 items-center justify-center">
            <SLoading />
          </div>
          <div
            v-else-if="resources.playlistAccess !== 'available'"
            class="flex min-h-56 flex-col items-center justify-center gap-3 text-sm text-on-surface-variant"
          >
            <IconLucideLockKeyhole
              v-if="resources.playlistAccess === 'private'"
              class="size-12 opacity-35"
            />
            <IconLucideTriangleAlert v-else class="size-12 opacity-35" />
            <span>
              {{
                resources.playlistAccess === "private"
                  ? t("userProfile.playlistPrivate", { name: profile.nickname })
                  : t("userProfile.playlistUnavailable")
              }}
            </span>
            <SButton
              v-if="resources.playlistAccess === 'unavailable'"
              variant="secondary"
              @click="loadResources(requestToken)"
            >
              {{ t("common.retry") }}
            </SButton>
          </div>
          <CoverList
            v-else-if="playlistItems.length"
            :items="playlistItems"
            :virtual="false"
            :padding-top="16"
            :padding-bottom="20"
            @click="openPlaylist"
          />
          <div
            v-else
            class="flex min-h-56 flex-col items-center justify-center text-on-surface-variant/45"
          >
            <IconLucideListMusic class="mb-3 size-12 opacity-35" />
            <span class="text-sm">{{ t("userProfile.playlistsEmpty") }}</span>
          </div>
        </template>

        <template v-else-if="activeTab === 'podcast'">
          <div class="flex items-center justify-between gap-4">
            <STabs v-model="podcastTab" :tabs="resourceTabs" />
            <button
              v-if="own && podcastTab === 'created'"
              type="button"
              class="border-0 bg-transparent px-1 py-1 text-sm text-primary transition-opacity hover:opacity-70 disabled:cursor-wait disabled:opacity-45"
              :disabled="managerOpening"
              @click="openPodcastManager"
            >
              {{ t("podcasts.manage") }}
            </button>
          </div>
          <div v-if="resourcesLoading" class="flex min-h-56 items-center justify-center">
            <SLoading />
          </div>
          <div
            v-else-if="activePodcastAccess !== 'available'"
            class="flex min-h-56 flex-col items-center justify-center gap-3 text-on-surface-variant/45"
          >
            <IconLucideLockKeyhole
              v-if="activePodcastAccess === 'private'"
              class="size-12 opacity-35"
            />
            <IconLucideTriangleAlert v-else class="size-12 opacity-35" />
            <span class="text-sm">
              {{
                activePodcastAccess === "private"
                  ? podcastTab === "created"
                    ? t("userProfile.createdPodcastsPrivate", { name: profile.nickname })
                    : t("userProfile.podcastPrivate", { name: profile.nickname })
                  : t("userProfile.podcastsUnavailable")
              }}
            </span>
            <SButton
              v-if="activePodcastAccess === 'unavailable'"
              variant="secondary"
              @click="loadResources(requestToken)"
            >
              {{ t("common.retry") }}
            </SButton>
          </div>
          <CoverList
            v-else-if="podcastItems.length"
            :items="podcastItems"
            :virtual="false"
            :padding-top="16"
            :padding-bottom="20"
            @click="openPodcast"
          />
          <div
            v-else
            class="flex min-h-56 flex-col items-center justify-center text-on-surface-variant/45"
          >
            <IconLucidePodcast class="mb-3 size-12 opacity-35" />
            <span class="text-sm">{{ t("userProfile.podcastsEmpty") }}</span>
          </div>
        </template>

        <UserNoteFeed v-else :user-id="profile.userId" />
      </section>
    </div>

    <UserProfileEditDialog
      v-if="profile && own"
      v-model:open="editOpen"
      :profile="profile"
      @saved="refreshAfterEdit"
    />
  </div>
</template>
