<script setup lang="ts">
import type { Track } from "@shared/types/player";
import { matchCloudSong } from "@/apis/cloud/netease";
import { searchSongs } from "@/apis/search";
import { dialog } from "@/composables/useDialog";
import { toast } from "@/composables/useToast";
import { useUserStore } from "@/stores/user";
import IconCheck from "~icons/lucide/check";
import IconLink2 from "~icons/lucide/link-2";
import IconMusic2 from "~icons/lucide/music-2";
import IconSearch from "~icons/lucide/search";
import IconUnlink from "~icons/lucide/unlink";

const props = defineProps<{
  open: boolean;
  track: Track | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  closed: [];
}>();

const { t } = useI18n();
const user = useUserStore();
const keyword = ref("");
const loading = ref(false);
const submitting = ref(false);
const searched = ref(false);
const error = ref("");
const results = shallowRef<Track[]>([]);
const selectedTrack = shallowRef<Track | null>(null);
let requestToken = 0;

const artistText = (track: Track): string =>
  track.artists.map((artist) => artist.name).join(" / ") || t("playlist.unknownArtist");

/** 搜索可匹配的网易云歌曲 */
const search = async (): Promise<void> => {
  const value = keyword.value.trim();
  if (!value || loading.value) return;
  const token = ++requestToken;
  loading.value = true;
  searched.value = true;
  error.value = "";
  try {
    const response = await searchSongs("netease", value, 0, 30);
    if (token !== requestToken) return;
    results.value = response.items;
  } catch (cause) {
    if (token !== requestToken) return;
    results.value = [];
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (token === requestToken) loading.value = false;
  }
};

/** 关闭弹窗并释放本次搜索结果 */
const close = (): void => {
  emit("update:open", false);
  emit("closed");
};

const onOpenUpdate = (value: boolean): void => {
  if (value) {
    emit("update:open", true);
    return;
  }
  close();
};

/** 提交歌曲匹配或解绑 */
const updateMatch = async (targetSongId: string | 0): Promise<void> => {
  const track = props.track;
  const userId = user.profile?.userId;
  if (!track || !userId || submitting.value) return;
  submitting.value = true;
  try {
    await matchCloudSong(userId, track.cloudId ?? track.id, targetSongId);
    await user.ensureCloud(true);
    toast.success(t(targetSongId === 0 ? "cloud.match.unbound" : "cloud.match.matched"));
    close();
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : t("cloud.match.failed"));
  } finally {
    submitting.value = false;
  }
};

const confirmMatch = (): void => {
  if (selectedTrack.value) void updateMatch(selectedTrack.value.id);
};

const unbind = async (): Promise<void> => {
  if (!props.track || submitting.value) return;
  const confirmed = await dialog.confirm({
    title: t("cloud.match.unbind"),
    content: t("cloud.match.unbindConfirm"),
    confirmText: t("cloud.match.unbind"),
    type: "warning",
  });
  if (confirmed) await updateMatch(0);
};

watch([() => props.open, () => props.track?.cloudId, () => props.track?.id], ([open]) => {
  requestToken += 1;
  loading.value = false;
  if (!open || !props.track) return;
  keyword.value = [props.track.title, props.track.artists.map((artist) => artist.name).join(" ")]
    .filter(Boolean)
    .join(" ");
  searched.value = false;
  error.value = "";
  results.value = [];
  selectedTrack.value = null;
  void nextTick(search);
});

onBeforeUnmount(() => {
  requestToken += 1;
});
</script>

<template>
  <SDialog
    :open="open"
    :title="t('cloud.match.title')"
    :description="t('cloud.match.description')"
    width="min(640px, 90vw)"
    height="min(590px, 82vh)"
    @update:open="onOpenUpdate"
  >
    <div class="flex h-full min-h-0 flex-col px-5 pb-1">
      <div v-if="track" class="shrink-0">
        <div class="mb-1.5 text-xs font-medium text-on-surface-variant/55">
          {{ t("cloud.match.currentSong") }}
        </div>
        <div
          class="flex items-center gap-3 rounded-xl border border-solid border-on-surface/8 bg-on-surface/3 p-2.5"
        >
          <SImg :src="track.cover" :alt="track.title" class="size-11 shrink-0 rounded-lg" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-on-surface">{{ track.title }}</div>
            <div class="mt-0.5 truncate text-xs text-on-surface-variant/50">
              {{ artistText(track) }}
            </div>
          </div>
          <IconLink2 class="size-4 shrink-0 text-on-surface-variant/35" />
        </div>
      </div>

      <div class="mt-3 flex shrink-0 gap-2">
        <SInput
          v-model="keyword"
          class="min-w-0 flex-1"
          :placeholder="t('cloud.match.searchPlaceholder')"
          clearable
          @keydown.enter="search"
        >
          <template #prefix>
            <IconSearch class="size-4 text-on-surface-variant/45" />
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
          <IconMusic2 class="size-10 opacity-40" />
          <span class="text-sm">{{ t("cloud.match.searchHint") }}</span>
        </div>
        <div v-else class="grid grid-cols-2 gap-2">
          <button
            v-for="item in results"
            :key="item.id"
            type="button"
            class="relative flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-solid p-2 text-left transition-colors duration-200"
            :class="
              selectedTrack?.id === item.id
                ? 'border-primary/45 bg-primary/12'
                : 'border-on-surface/8 bg-on-surface/3 hover:bg-on-surface/8'
            "
            @click="selectedTrack = item"
          >
            <SImg :src="item.cover" :alt="item.title" class="size-11 shrink-0 rounded-lg" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-on-surface">{{ item.title }}</div>
              <div class="mt-0.5 truncate text-xs text-on-surface-variant/50">
                {{ artistText(item) }}
              </div>
            </div>
            <span
              v-if="selectedTrack?.id === item.id"
              class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
            >
              <IconCheck class="size-3.5" />
            </span>
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <SButton
        type="error"
        variant="text"
        class="mr-auto"
        :disabled="!track || submitting"
        @click="unbind"
      >
        <template #icon>
          <IconUnlink />
        </template>
        {{ t("cloud.match.unbind") }}
      </SButton>
      <SButton variant="secondary" :disabled="submitting" @click="close">
        {{ t("common.cancel") }}
      </SButton>
      <SButton
        type="primary"
        :loading="submitting"
        :disabled="!selectedTrack"
        @click="confirmMatch"
      >
        {{ t("cloud.match.confirm") }}
      </SButton>
    </template>
  </SDialog>
</template>
