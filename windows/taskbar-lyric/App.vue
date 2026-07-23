<script setup lang="ts">
import type { LyricLine } from "@shared/types/lyrics";
import type { LocaleCode, TaskbarLyricSettings } from "@shared/types/settings";
import type { TaskbarPlaybackSnapshot, TaskbarPlayMode } from "@shared/types/taskbarLyric";
import DEFAULT_COVER from "@/assets/images/song.jpg";
import IconSkipBack from "~icons/lucide/skip-back";
import IconSkipForward from "~icons/lucide/skip-forward";
import IconPlay from "~icons/lucide/play";
import IconPause from "~icons/lucide/pause";
import IconRepeat from "~icons/lucide/repeat";
import IconRepeatOne from "~icons/lucide/repeat-1";
import IconShuffle from "~icons/lucide/shuffle";
import IconListMusic from "~icons/lucide/list-music";
import IconPlayOrder from "~icons/sp/play-order";
import TaskbarLyricLine from "./components/TaskbarLyricLine.vue";
import { hasRealWordTiming, pickPrimaryIndex } from "@shared/utils/lyricSync";
import { useNowPlayingSync } from "@windows/shared/composables/useNowPlayingSync";

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
  pureLyricMode: false,
  separateCoverAndLyric: false,
  wordByWord: true,
  autoGenerateWordByWord: true,
  fontSize: 14,
  fontWeight: 400,
  translationFontWeight: 400,
  fontFamily: "",
});

const anchor = ref<"left" | "right">("left");
const taskbarIsLight = ref(false);
const isHovered = ref(false);
const coverHovered = ref(false);
const playMode = ref<TaskbarPlayMode>("repeat-list");
const playModeDisabled = ref(true);
const locale = ref<LocaleCode>("zh-CN");

const { track, lyric, primaryIndex, playing } = useNowPlayingSync({
  pickIndex: pickPrimaryIndex,
  logTag: "taskbar-lyric",
});

const currentLine = computed<LyricLine | null>(() => {
  const idx = primaryIndex.value;
  if (idx < 0) return null;
  return lyric.value[idx] ?? null;
});

const hasLyric = computed(() => lyric.value.length > 0 && primaryIndex.value >= 0);
const separationEnabled = computed(() => config.separateCoverAndLyric && !config.pureLyricMode);
const controlsVisible = computed(() =>
  config.pureLyricMode
    ? false
    : separationEnabled.value
      ? config.showCover && coverHovered.value
      : isHovered.value,
);
const songInfoVisible = computed(() => !config.pureLyricMode && controlsVisible.value);

const titleText = computed<string>(() => track.value?.title ?? "SPlayer Next");
const artistsText = computed<string>(
  () => track.value?.artists?.map((artist) => artist.name).join(" / ") || "未知艺术家",
);

const effectiveTheme = computed<"light" | "dark">(() => {
  if (config.colorMode === "light") return "light";
  if (config.colorMode === "dark") return "dark";
  if (config.colorMode === "taskbarInverse") return taskbarIsLight.value ? "dark" : "light";
  return taskbarIsLight.value ? "light" : "dark";
});

interface RenderItem {
  key: string;
  role: "primary" | "secondary";
  kind: "lyric" | "translation" | "meta";
  text: string;
  line?: LyricLine;
}

const items = computed<RenderItem[]>(() => {
  if (hasLyric.value) {
    const idx = primaryIndex.value;
    const line = currentLine.value!;
    const list: RenderItem[] = [
      {
        key: `line-${idx}`,
        role: "primary",
        kind: "lyric",
        text: line.words.map((word) => word.word).join(""),
        line,
      },
    ];
    if (config.doubleLine) {
      const translation = config.showTranslation ? line.translatedLyric : "";
      if (translation) {
        list.push({
          key: `translation-${idx}`,
          role: "secondary",
          kind: "translation",
          text: translation,
        });
      } else {
        const next = lyric.value[idx + 1];
        if (next) {
          list.push({
            key: `line-${idx + 1}`,
            role: "secondary",
            kind: "lyric",
            text: next.words.map((word) => word.word).join(""),
            line: next,
          });
        }
      }
    }
    return list;
  }

  const list: RenderItem[] = [
    { key: "meta-title", role: "primary", kind: "meta", text: titleText.value },
  ];
  if (config.doubleLine) {
    list.push({
      key: "meta-artist",
      role: "secondary",
      kind: "meta",
      text: artistsText.value,
    });
  }
  return list;
});

const shouldRenderWordByWord = (item: RenderItem): boolean => {
  if (!config.wordByWord || !item.line) return false;
  return config.autoGenerateWordByWord || hasRealWordTiming(item.line);
};

const rootStyle = computed(() => ({
  "--tbl-font-size": `${config.fontSize}px`,
  "--tbl-font-weight": config.fontWeight,
  "--tbl-translation-font-weight": config.translationFontWeight,
  fontFamily: config.fontFamily || undefined,
}));

const controlLabels: Record<
  LocaleCode,
  {
    prev: string;
    next: string;
    play: string;
    pause: string;
    queue: string;
    modes: Record<TaskbarPlayMode, string>;
  }
> = {
  "zh-CN": {
    prev: "上一首",
    next: "下一首",
    play: "播放",
    pause: "暂停",
    queue: "播放列表",
    modes: {
      "repeat-list": "列表循环",
      "repeat-one": "单曲循环",
      shuffle: "随机播放",
      sequential: "顺序播放",
    },
  },
  "en-US": {
    prev: "Previous",
    next: "Next",
    play: "Play",
    pause: "Pause",
    queue: "Queue",
    modes: {
      "repeat-list": "Repeat All",
      "repeat-one": "Repeat One",
      shuffle: "Shuffle",
      sequential: "Sequential",
    },
  },
};

const labels = computed(() => controlLabels[locale.value]);
const playModeIcon = computed(() => {
  switch (playMode.value) {
    case "repeat-one":
      return IconRepeatOne;
    case "shuffle":
      return IconShuffle;
    case "sequential":
      return IconPlayOrder;
    case "repeat-list":
      return IconRepeat;
  }
  return IconRepeat;
});

const applyPlaybackSnapshot = (snapshot: TaskbarPlaybackSnapshot): void => {
  playMode.value = snapshot.playMode;
  playModeDisabled.value = snapshot.playModeDisabled;
  locale.value = snapshot.locale;
};

const handlePrev = (): void => window.api.player.dispatch("prev");
const handleNext = (): void => window.api.player.dispatch("next");
const handleTogglePlay = (): void => window.api.player.dispatch(playing.value ? "pause" : "play");
const handleCyclePlayMode = (): void => window.api.taskbarLyric.cyclePlayMode();
const handleToggleQueue = (): void => window.api.taskbarLyric.toggleQueue();
const handleFocusMain = (): void => {
  if (config.pureLyricMode) return;
  window.api.system.focusMainWindow().catch(() => {});
};

const handleContainerEnter = (): void => {
  if (config.pureLyricMode) return;
  isHovered.value = true;
};

const handleContainerLeave = (): void => {
  isHovered.value = false;
};

const handleContainerDoubleClick = (): void => {
  if (!config.pureLyricMode && !separationEnabled.value) handleFocusMain();
};

const unsubscribers: Array<() => void> = [];

onMounted(async () => {
  try {
    const saved = (await window.api.config.get("taskbarLyric")) as TaskbarLyricSettings | null;
    if (saved) Object.assign(config, saved);
  } catch (error) {
    console.error("[taskbar-lyric] load config failed", error);
  }

  unsubscribers.push(
    window.api.taskbarLyric.onLayout((data) => {
      anchor.value = data.anchor;
      taskbarIsLight.value = data.isLight;
    }),
    window.api.taskbarLyric.onConfigChange((next) => {
      Object.assign(config, next);
      if (!next.separateCoverAndLyric || !next.showCover || next.pureLyricMode) {
        coverHovered.value = false;
      }
      if (next.pureLyricMode) isHovered.value = false;
    }),
    window.api.taskbarLyric.onCoverHover((hovered) => {
      if (separationEnabled.value && config.showCover) coverHovered.value = hovered;
    }),
    window.api.taskbarLyric.onPlaybackChange(applyPlaybackSnapshot),
  );

  try {
    applyPlaybackSnapshot(await window.api.taskbarLyric.requestPlayback());
  } catch (error) {
    console.error("[taskbar-lyric] request playback failed", error);
  }
});

onBeforeUnmount(() => {
  for (const off of unsubscribers) off();
});
</script>

<template>
  <div class="wrapper" :data-align="anchor">
    <div
      class="taskbar-lyric-container"
      :class="{
        'is-separated': separationEnabled,
        'is-pure': config.pureLyricMode,
        'has-cover': config.showCover,
        'show-controls': controlsVisible,
        'show-song-info': songInfoVisible,
      }"
      :data-theme="effectiveTheme"
      :data-align="anchor"
      :style="rootStyle"
      @mouseenter="handleContainerEnter"
      @mouseleave="handleContainerLeave"
      @dblclick="handleContainerDoubleClick"
    >
      <div
        class="interactive-zone"
        :class="{ 'show-controls': controlsVisible }"
        @dblclick.stop="handleFocusMain"
      >
        <div v-if="config.showCover" class="cover-wrapper">
          <img
            class="cover"
            :src="track?.cover || DEFAULT_COVER"
            alt=""
            draggable="false"
            decoding="async"
            @error="($event.target as HTMLImageElement).src = DEFAULT_COVER"
          />
        </div>

        <div v-if="!config.pureLyricMode" class="controls-wrapper">
          <div class="controls-inner">
            <button
              class="control-btn"
              type="button"
              :title="labels.prev"
              :aria-label="labels.prev"
              @click.stop="handlePrev"
              @dblclick.stop
            >
              <IconSkipBack class="control-icon" />
            </button>
            <button
              class="control-btn"
              type="button"
              :title="playing ? labels.pause : labels.play"
              :aria-label="playing ? labels.pause : labels.play"
              @click.stop="handleTogglePlay"
              @dblclick.stop
            >
              <component :is="playing ? IconPause : IconPlay" class="control-icon" />
            </button>
            <button
              class="control-btn"
              type="button"
              :title="labels.next"
              :aria-label="labels.next"
              @click.stop="handleNext"
              @dblclick.stop
            >
              <IconSkipForward class="control-icon" />
            </button>
            <button
              class="control-btn"
              type="button"
              :title="labels.modes[playMode]"
              :aria-label="labels.modes[playMode]"
              :disabled="playModeDisabled"
              @click.stop="handleCyclePlayMode"
              @dblclick.stop
            >
              <component :is="playModeIcon" class="control-icon" />
            </button>
            <button
              class="control-btn"
              type="button"
              :title="labels.queue"
              :aria-label="labels.queue"
              @click.stop="handleToggleQueue"
              @dblclick.stop
            >
              <IconListMusic class="control-icon" />
            </button>
          </div>
        </div>
      </div>

      <div class="lyric-area">
        <TransitionGroup tag="div" name="line" class="lyric-column">
          <div
            v-for="item in items"
            :key="item.key"
            class="lyric-line"
            :data-role="item.role"
            :data-kind="item.kind"
          >
            <TaskbarLyricLine
              :line="item.line"
              :text="item.text"
              :word-by-word="shouldRenderWordByWord(item)"
              :anchor="anchor"
            />
          </div>
        </TransitionGroup>
        <div class="song-info">
          <div class="song-title">{{ titleText }}</div>
          <div v-if="config.doubleLine" class="song-artist">
            {{ artistsText }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.wrapper {
  width: 100vw;
  height: 100vh;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  pointer-events: none;
}
.wrapper[data-align="right"] {
  justify-content: flex-end;
}
.taskbar-lyric-container {
  --tbl-text-primary: #ffffff;
  --tbl-text-secondary: rgba(255, 255, 255, 0.5);
  --tbl-hover-bg: rgba(255, 255, 255, 0.12);
  --tbl-played: var(--tbl-text-primary);
  --tbl-unplayed: var(--tbl-text-secondary);
  --tbl-control-size: clamp(16px, calc((100vw - 44px) / 5), calc(100vh - 16px));
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  border-radius: 8px;
  background: transparent;
  overflow: hidden;
  pointer-events: auto;
  color: var(--tbl-text-primary);
  transition: background 0.3s;
}
.taskbar-lyric-container.has-cover {
  --tbl-control-size: clamp(16px, calc((100vw - 100vh - 36px) / 5), calc(100vh - 16px));
}
.taskbar-lyric-container.is-pure {
  pointer-events: none;
}
.taskbar-lyric-container[data-align="right"] {
  flex-direction: row-reverse;
}
.taskbar-lyric-container[data-theme="light"] {
  --tbl-text-primary: #1a1a1a;
  --tbl-text-secondary: rgba(0, 0, 0, 0.62);
  --tbl-hover-bg: rgba(0, 0, 0, 0.08);
}
.taskbar-lyric-container:not(.is-separated):hover {
  background: var(--tbl-hover-bg);
}
.interactive-zone {
  flex: 0 0 auto;
  align-self: stretch;
  display: flex;
  min-width: 0;
  border-radius: 8px;
  overflow: hidden;
  transition: background 0.3s;
}
.taskbar-lyric-container[data-align="right"] .interactive-zone {
  flex-direction: row-reverse;
}
.taskbar-lyric-container.is-separated .interactive-zone.show-controls {
  background: var(--tbl-hover-bg);
}
.cover-wrapper {
  flex: 0 0 auto;
  height: 100%;
  aspect-ratio: 1 / 1;
  padding: 4px;
  overflow: hidden;
  cursor: default;
}
.cover {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
  display: block;
}
.controls-wrapper {
  flex: 0 0 auto;
  align-self: stretch;
  display: flex;
  max-width: 0;
  overflow: hidden;
  pointer-events: none;
  transition: max-width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.controls-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.interactive-zone.show-controls .controls-wrapper {
  max-width: calc(5 * var(--tbl-control-size) + 24px);
  pointer-events: auto;
}
.interactive-zone.show-controls .controls-inner {
  opacity: 1;
  transition-delay: 0.1s;
}
.control-btn {
  flex: 0 0 auto;
  width: var(--tbl-control-size);
  height: var(--tbl-control-size);
  border-radius: 6px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--tbl-text-primary) 24%, transparent);
  color: var(--tbl-text-primary);
  cursor: pointer;
  transition:
    background 0.3s,
    opacity 0.2s,
    transform 0.3s;
}
.control-btn:hover {
  background: color-mix(in srgb, var(--tbl-text-primary) 16%, transparent);
}
.control-btn:active {
  transform: scale(0.9);
}
.control-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.control-icon {
  width: 14px;
  height: 14px;
}
.lyric-area {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0 4px;
  position: relative;
  height: 100%;
  overflow: hidden;
}
.taskbar-lyric-container.is-separated .lyric-area {
  pointer-events: none;
}
.lyric-column {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  opacity: 1;
  transition: opacity 0.18s ease;
}
.taskbar-lyric-container[data-align="right"] .lyric-column {
  align-items: flex-end;
}
.taskbar-lyric-container.show-song-info .lyric-column {
  opacity: 0;
  pointer-events: none;
}
.lyric-line {
  width: 100%;
  transform-origin: left center;
  font-weight: var(--tbl-font-weight);
  transition:
    font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.3s ease;
}
.taskbar-lyric-container[data-align="right"] .lyric-line {
  transform-origin: right center;
}
.lyric-line[data-role="primary"] {
  font-size: var(--tbl-font-size);
  color: var(--tbl-text-primary);
}
.lyric-line[data-role="secondary"] {
  font-size: calc(var(--tbl-font-size) * 0.82);
  color: var(--tbl-text-secondary);
}
.lyric-line[data-kind="translation"] {
  font-weight: var(--tbl-translation-font-weight);
}
.line-move,
.line-enter-active,
.line-leave-active {
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.3s ease;
}
.line-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}
.line-enter-from {
  opacity: 0;
  transform: translateY(100%);
}
.line-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
.song-info {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}
.taskbar-lyric-container[data-align="right"] .song-info {
  align-items: flex-end;
}
.taskbar-lyric-container.show-song-info .song-info {
  opacity: 1;
  transition-delay: 0.08s;
}
.song-title,
.song-artist {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.song-title {
  font-size: var(--tbl-font-size);
  color: var(--tbl-text-primary);
}
.song-artist {
  font-size: calc(var(--tbl-font-size) * 0.82);
  color: var(--tbl-text-secondary);
}
</style>
