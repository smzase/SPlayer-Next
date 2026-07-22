<script setup lang="ts">
import type { TaskbarLyricSettings } from "@shared/types/settings";
import type { TaskbarPlaybackSnapshot, TaskbarQueueItem } from "@shared/types/taskbarLyric";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";
import SVirtualList from "@/components/ui/SVirtualList.vue";
import DEFAULT_COVER from "@/assets/images/song.jpg";
import IconListMusic from "~icons/lucide/list-music";
import IconMusic2 from "~icons/lucide/music-2";

const snapshot = shallowRef<TaskbarPlaybackSnapshot>({
  items: [],
  currentTrackId: null,
  playMode: "repeat-list",
  playModeDisabled: true,
  locale: "zh-CN",
  theme: {
    isDark: true,
    appearanceStyle: "solid",
    imageBackground: {
      src: "",
      blur: 0,
      dim: 0.4,
      scale: 1.2,
    },
    primary: "244 244 245",
    primaryContainer: "63 63 70",
    surface: "16 16 20",
    surfaceAlt: "39 39 42",
    surfacePanel: "24 24 28",
    surfaceBright: "72 72 78",
    onSurface: "244 244 245",
    onSurfaceVariant: "161 161 170",
    outline: "82 82 91",
    outlineVariant: "63 63 70",
  },
});
const config = reactive<TaskbarLyricSettings>({
  position: "auto",
  autoMaxWidth: true,
  maxWidth: 400,
  leftMargin: 0,
  rightMargin: 0,
  colorMode: "taskbar",
  doubleLine: true,
  showTranslation: true,
  showCover: true,
  separateCoverAndLyric: false,
  wordByWord: true,
  autoGenerateWordByWord: true,
  fontSize: 14,
  fontWeight: 400,
  translationFontWeight: 400,
  fontFamily: "",
});
const listRef = shallowRef<SVirtualListExposed | null>(null);
const unsubscribers: Array<() => void> = [];

const effectiveTheme = computed<"light" | "dark">(() =>
  snapshot.value.theme.isDark ? "dark" : "light",
);

const queueStyle = computed(() => {
  const palette = snapshot.value.theme;
  return {
    "--queue-primary": palette.primary,
    "--queue-primary-container": palette.primaryContainer,
    "--queue-surface": palette.surface,
    "--queue-surface-alt": palette.surfaceAlt,
    "--queue-surface-panel": palette.surfacePanel,
    "--queue-surface-bright": palette.surfaceBright,
    "--queue-on-surface": palette.onSurface,
    "--queue-on-surface-variant": palette.onSurfaceVariant,
    "--queue-outline": palette.outline,
    "--queue-outline-variant": palette.outlineVariant,
    fontFamily: config.fontFamily || undefined,
  };
});

const effectiveAppearance = computed(() => snapshot.value.theme.appearanceStyle);
const backgroundImage = computed(() => snapshot.value.theme.imageBackground);
const backgroundVisible = computed(
  () => effectiveAppearance.value === "image" && !!backgroundImage.value.src,
);
const backgroundImageStyle = computed<Record<string, string>>(() => ({
  filter:
    backgroundImage.value.blur > 0 ? `blur(${backgroundImage.value.blur}px)` : "none",
  transform: `scale(${backgroundImage.value.scale})`,
}));
const backgroundDimStyle = computed(() => ({
  opacity: backgroundImage.value.dim,
}));

const items = computed(() => snapshot.value.items);
const currentIndex = computed(() =>
  items.value.findIndex((item) => item.id === snapshot.value.currentTrackId),
);
const isChinese = computed(() => snapshot.value.locale === "zh-CN");
const title = computed(() => (isChinese.value ? "播放列表" : "Queue"));
const total = computed(() =>
  isChinese.value ? `${items.value.length} 首歌曲` : `${items.value.length} songs`,
);
const emptyText = computed(() => (isChinese.value ? "播放列表为空" : "Queue is empty"));

const applySnapshot = (next: TaskbarPlaybackSnapshot): void => {
  snapshot.value = next;
};

const playItem = (item: TaskbarQueueItem): void => {
  window.api.taskbarLyric.playTrack(item.id);
  window.api.taskbarLyric.closeQueue();
};

watch(currentIndex, (index) => {
  if (index >= 0) nextTick(() => listRef.value?.scrollToIndex(index));
});

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") window.api.taskbarLyric.closeQueue();
};

onMounted(async () => {
  unsubscribers.push(
    window.api.taskbarLyric.onPlaybackChange(applySnapshot),
    window.api.taskbarLyric.onConfigChange((next) => Object.assign(config, next)),
  );
  try {
    const saved = (await window.api.config.get("taskbarLyric")) as TaskbarLyricSettings | null;
    if (saved) Object.assign(config, saved);
  } catch (error) {
    console.error("[taskbar-queue] load config failed", error);
  }
  try {
    applySnapshot(await window.api.taskbarLyric.requestPlayback());
  } catch (error) {
    console.error("[taskbar-queue] request playback failed", error);
  }
  window.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  for (const off of unsubscribers) off();
});
</script>

<template>
  <div
    class="queue-root"
    :data-theme="effectiveTheme"
    :data-appearance="effectiveAppearance"
    :style="queueStyle"
  >
    <div v-if="backgroundVisible" class="queue-background" aria-hidden="true">
      <img
        :src="backgroundImage.src"
        class="queue-background-image"
        :style="backgroundImageStyle"
        alt=""
        draggable="false"
        decoding="async"
      />
      <div class="queue-background-dim" :style="backgroundDimStyle" />
    </div>
    <section class="queue-panel">
      <header class="queue-header">
        <div class="queue-heading">
          <IconListMusic class="queue-header-icon" />
          <div class="queue-heading-text">
            <strong>{{ title }}</strong>
            <span>{{ total }}</span>
          </div>
        </div>
        <IconMusic2 class="queue-status-icon" />
      </header>

      <div v-if="items.length > 0" class="queue-list">
        <SVirtualList
          ref="listRef"
          :items="items"
          :item-height="58"
          item-fixed
          height="100%"
          hide-scrollbar
          :default-scroll-index="Math.max(0, currentIndex)"
          :get-item-key="(item: TaskbarQueueItem) => item.id"
        >
          <template #default="{ item }: { item: TaskbarQueueItem }">
            <button
              class="queue-item"
              :class="{ 'is-current': item.id === snapshot.currentTrackId }"
              type="button"
              @click="playItem(item)"
            >
              <img
                class="queue-cover"
                :src="item.cover || DEFAULT_COVER"
                alt=""
                draggable="false"
                decoding="async"
                @error="($event.target as HTMLImageElement).src = DEFAULT_COVER"
              />
              <span class="queue-item-copy">
                <span class="queue-item-title">{{ item.title }}</span>
                <span class="queue-item-artist">
                  {{ item.artists || (isChinese ? "未知艺术家" : "Unknown artist") }}
                </span>
              </span>
              <span v-if="item.id === snapshot.currentTrackId" class="queue-current-dot" />
            </button>
          </template>
        </SVirtualList>
      </div>

      <div v-else class="queue-empty">
        <IconListMusic class="queue-empty-icon" />
        <span>{{ emptyText }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.queue-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  padding: 8px;
  color: rgb(var(--queue-on-surface));
}
.queue-background {
  position: absolute;
  inset: 8px;
  overflow: hidden;
  border-radius: 8px;
  pointer-events: none;
}
.queue-background-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.queue-background-dim {
  position: absolute;
  inset: 0;
  background: #000;
}
.queue-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(var(--queue-outline-variant) / 0.72);
  border-radius: 8px;
  background: rgb(var(--queue-surface-panel));
}
.queue-root[data-appearance="image"] .queue-panel {
  background: rgb(var(--queue-surface-bright) / 0.22);
  backdrop-filter: blur(16px) saturate(1.15);
}
.queue-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
  padding: 0 14px;
  border-bottom: 1px solid rgb(var(--queue-outline-variant) / 0.72);
}
.queue-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.queue-header-icon {
  width: 18px;
  height: 18px;
  opacity: 0.78;
}
.queue-heading-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.queue-heading-text strong {
  font-size: 14px;
  line-height: 1.2;
  font-weight: 600;
}
.queue-heading-text span {
  color: rgb(var(--queue-on-surface-variant) / 0.72);
  font-size: 11px;
  line-height: 1.2;
}
.queue-status-icon {
  width: 16px;
  height: 16px;
  opacity: 0.3;
}
.queue-list {
  flex: 1 1 auto;
  min-height: 0;
  padding: 6px 4px;
}
.queue-item {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}
.queue-item:hover {
  background: rgb(var(--queue-surface-alt) / 0.86);
}
.queue-item.is-current {
  color: rgb(var(--queue-primary));
  background: rgb(var(--queue-primary-container) / 0.72);
}
.queue-cover {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 5px;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgb(var(--queue-outline-variant) / 0.5);
}
.queue-item-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.queue-item-title,
.queue-item-artist {
  display: block;
  max-width: 220px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.queue-item-title {
  font-size: 12px;
  line-height: 1.2;
  font-weight: 500;
}
.queue-item-artist {
  color: rgb(var(--queue-on-surface-variant) / 0.72);
  font-size: 11px;
  line-height: 1.2;
}
.queue-current-dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  margin-left: auto;
  border-radius: 50%;
  background: currentColor;
}
.queue-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgb(var(--queue-on-surface-variant) / 0.56);
  font-size: 12px;
}
.queue-empty-icon {
  width: 30px;
  height: 30px;
  opacity: 0.6;
}
</style>
