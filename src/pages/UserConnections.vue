<script setup lang="ts">
import type { UserConnection, UserConnectionKind, UserPageProfile } from "@/types/user-profile";
import {
  fetchUserConnections,
  fetchUserFollowers,
  fetchUserPageProfile,
  setUserFollowed,
} from "@/apis/user-profile/netease";
import { useUserStore } from "@/stores/user";
import { toast } from "@/composables/useToast";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const user = useUserStore();
const profile = shallowRef<UserPageProfile | null>(null);
const items = shallowRef<UserConnection[]>([]);
const activeKind = ref<UserConnectionKind>("all");
const loading = ref(false);
const loadingMore = ref(false);
const loaded = ref(false);
const error = ref("");
const more = ref(false);
const cursor = ref(0);
const relationLoadingId = ref<number | null>(null);
let requestToken = 0;

const uid = computed(() => Number(route.params.uid) || 0);
const own = computed(() => uid.value === user.profile?.userId);
const mode = computed<"follows" | "followers">(() =>
  route.query.type === "followers" ? "followers" : "follows",
);
const tabs = computed(() => [
  { key: "all", label: t("userProfile.connections.all") },
  { key: "artist", label: t("userProfile.connections.artists") },
  { key: "user", label: t("userProfile.connections.users") },
]);

const privacyMessage = (cause: unknown): string => {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /403|privacy|permission|权限|隐私|不可见|无权/i.test(message)
    ? t("userProfile.connections.private")
    : message || t("userProfile.connections.loadFailed");
};

const load = async (append = false): Promise<void> => {
  if (!uid.value || loading.value || loadingMore.value) return;
  const token = ++requestToken;
  if (append) loadingMore.value = true;
  else loading.value = true;
  error.value = "";
  try {
    const page =
      mode.value === "followers"
        ? await fetchUserFollowers(uid.value, append ? cursor.value : 0)
        : await fetchUserConnections(
            uid.value,
            activeKind.value,
            own.value,
            append ? cursor.value : 0,
          );
    if (token !== requestToken) return;
    if (append) {
      const existing = new Set(items.value.map((item) => item.kind + ":" + item.id));
      items.value = [
        ...items.value,
        ...page.items.filter((item) => !existing.has(item.kind + ":" + item.id)),
      ];
    } else {
      items.value = page.items;
    }
    cursor.value = page.nextCursor ?? 0;
    more.value = page.more;
    loaded.value = true;
  } catch (cause) {
    if (token !== requestToken) return;
    error.value = privacyMessage(cause);
  } finally {
    if (token === requestToken) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
};

const resetAndLoad = (): void => {
  requestToken += 1;
  items.value = [];
  cursor.value = 0;
  more.value = false;
  loaded.value = false;
  void load();
};

watch(
  [uid, mode],
  async ([id]) => {
    profile.value = null;
    activeKind.value = "all";
    resetAndLoad();
    if (id) {
      profile.value = await fetchUserPageProfile(id, user.profile?.userId).catch(() => null);
    }
  },
  { immediate: true },
);

watch(activeKind, () => {
  if (mode.value === "follows") resetAndLoad();
});

const openConnection = (item: UserConnection): void => {
  if (item.kind === "artist") router.push("/artist/netease/" + encodeURIComponent(item.id));
  else router.push({ name: "user-profile", params: { uid: item.id } });
};

const toggleFollow = async (item: UserConnection): Promise<void> => {
  if (relationLoadingId.value || item.id === user.profile?.userId) return;
  relationLoadingId.value = item.id;
  try {
    const followed = !item.followed;
    await setUserFollowed(item.id, followed);
    if (own.value && mode.value === "follows" && !followed) {
      items.value = items.value.filter((value) => !(value.kind === "user" && value.id === item.id));
    } else {
      items.value = items.value.map((value) =>
        value.kind === "user" && value.id === item.id ? { ...value, followed } : value,
      );
    }
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    relationLoadingId.value = null;
  }
};
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-[920px] px-6 pb-16 pt-5">
      <header class="mb-5 flex items-center gap-3">
        <SButton variant="ghost" circle @click="router.back()">
          <template #icon><IconLucideArrowLeft /></template>
        </SButton>
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-bold text-on-surface">
            {{
              mode === "followers"
                ? t("userProfile.connections.followersTitle", {
                    name: profile?.nickname || t("userProfile.title"),
                  })
                : t("userProfile.connections.followsTitle", {
                    name: profile?.nickname || t("userProfile.title"),
                  })
            }}
          </h1>
          <p class="mt-0.5 text-sm text-on-surface-variant/50">
            {{ t("userProfile.id", { id: uid }) }}
          </p>
        </div>
      </header>

      <STabs v-if="mode === 'follows'" v-model="activeKind" :tabs="tabs" class="mb-4" />

      <div
        v-if="loading && !loaded"
        class="flex min-h-80 items-center justify-center gap-2 text-sm text-on-surface-variant/55"
      >
        <SLoading />
        {{ t("common.loading") }}
      </div>
      <div
        v-else-if="error && !items.length"
        class="flex min-h-80 flex-col items-center justify-center gap-3"
      >
        <IconLucideLockKeyhole class="size-12 text-on-surface-variant/35" />
        <p class="max-w-md text-center text-sm text-on-surface-variant">{{ error }}</p>
        <SButton variant="secondary" @click="resetAndLoad">{{ t("common.retry") }}</SButton>
      </div>
      <div
        v-else-if="loaded && !items.length"
        class="flex min-h-80 flex-col items-center justify-center gap-2 text-on-surface-variant/45"
      >
        <IconLucideUsersRound class="size-12 opacity-35" />
        <p class="text-sm">
          {{
            !own && mode === "follows" && activeKind === "artist"
              ? t("userProfile.connections.artistUnavailable")
              : t("userProfile.connections.empty")
          }}
        </p>
      </div>
      <div v-else class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <SCard
          v-for="item in items"
          :key="item.kind + ':' + item.id"
          size="small"
          radius="lg"
          class="group"
        >
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="size-12 shrink-0 cursor-pointer overflow-hidden rounded-full border-0 bg-on-surface/8 p-0"
              @click="openConnection(item)"
            >
              <img
                v-if="item.avatar"
                :src="item.avatar"
                :alt="item.name"
                decoding="async"
                class="size-full object-cover"
              />
              <IconLucideUserRound v-else class="m-auto size-5 text-on-surface-variant/45" />
            </button>
            <button
              type="button"
              class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
              @click="openConnection(item)"
            >
              <div class="truncate text-sm font-semibold text-on-surface">{{ item.name }}</div>
              <div class="mt-1 truncate text-xs text-on-surface-variant/50">
                {{ item.signature || t("userProfile.noSignature") }}
              </div>
            </button>
            <SButton
              v-if="item.kind === 'user' && item.id !== user.profile?.userId"
              :type="item.followed ? 'default' : 'primary'"
              :variant="item.followed ? 'secondary' : 'filled'"
              size="small"
              round
              :loading="relationLoadingId === item.id"
              @click="toggleFollow(item)"
            >
              {{
                item.mutual
                  ? t("userProfile.mutual")
                  : item.followed
                    ? t("userProfile.following")
                    : t("userProfile.follow")
              }}
            </SButton>
          </div>
        </SCard>
      </div>

      <div v-if="items.length && (more || loadingMore)" class="flex justify-center py-5">
        <SButton variant="text" :loading="loadingMore" @click="load(true)">
          {{ t("common.loadMore") }}
        </SButton>
      </div>
    </div>
  </div>
</template>
