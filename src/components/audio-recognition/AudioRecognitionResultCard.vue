<script setup lang="ts">
import type { LyricLine } from "@shared/types/lyrics";
import type { AudioRecognitionResult } from "@/stores/audioRecognition";
import AudioRecognitionLyricText from "./AudioRecognitionLyricText.vue";
import { requestPlatformLyric } from "@/services/lyric/request";
import { parseLyric } from "@/utils/lyric/parse";
import { normalizeLyricLines } from "@/utils/lyric/normalize";
import { stripLyricMetadata } from "@/utils/lyric/lyricStripper";
import {
  keywords as defaultExcludeKeywords,
  regexes as defaultExcludeRegexes,
} from "@/utils/lyric/excludeRules";
import { pickLatestActiveIndex, pickLatestStartedIndex } from "@shared/utils/lyricSync";
import { formatTime } from "@/utils/time";
import { navigateToAlbum, navigateToArtist } from "@/utils/navigate";
import { useSettingsStore } from "@/stores/settings";

const props = defineProps<{
  result: AudioRecognitionResult;
  index: number;
  currentTime: number | null;
  playing: boolean;
  progressing: boolean;
  rate: number;
}>();

const emit = defineEmits<{
  play: [];
}>();

const { t } = useI18n();
const settings = useSettingsStore();
const lyricLines = shallowRef<LyricLine[]>([]);
const backgroundLyricLines = shallowRef<LyricLine[]>([]);
const lyricLoading = ref(false);
let loadToken = 0;

const INSTRUMENTAL_PLACEHOLDERS = new Set([
  "纯音乐请欣赏",
  "此歌曲为没有填词的纯音乐请您欣赏",
  "純音樂請欣賞",
  "此歌曲為沒有填詞的純音樂請您欣賞",
]);

/** 获取歌词行的可见文本 */
const lineText = (line: LyricLine): string =>
  line.words
    .map((word) => word.word)
    .join("")
    .trim();

/** 判断网易云用于纯音乐的占位歌词 */
const isInstrumentalPlaceholder = (text: string): boolean =>
  INSTRUMENTAL_PLACEHOLDERS.has(text.replace(/[\s，,。.!！]/g, ""));

/** 为当前候选加载网易云歌词与翻译 */
const loadLyric = async (): Promise<void> => {
  const token = ++loadToken;
  lyricLines.value = [];
  backgroundLyricLines.value = [];
  if (props.result.startTime === null) return;

  lyricLoading.value = true;
  try {
    const lyric = await requestPlatformLyric("netease", props.result.track);
    if (token !== loadToken) return;
    if (!lyric) return;
    const lines = parseLyric(lyric, lyric.format, settings.locale, {
      detectBackground: settings.lyric.detectBackgroundLyrics,
    });
    normalizeLyricLines(lines);
    const mainLines = lines.filter((line) => !line.isBG && lineText(line).length > 0);
    const contentLines = stripLyricMetadata(mainLines, {
      keywords: defaultExcludeKeywords,
      regexPatterns: defaultExcludeRegexes,
    });
    const visibleMainLines = contentLines.filter(
      (line) => !isInstrumentalPlaceholder(lineText(line)),
    );
    const visibleMainSet = new Set(visibleMainLines);
    const backgroundLines: LyricLine[] = [];
    let includeAttachedBackground = false;
    for (const line of lines) {
      if (!line.isBG) {
        includeAttachedBackground = visibleMainSet.has(line);
        continue;
      }
      if (
        includeAttachedBackground &&
        lineText(line).length > 0 &&
        !isInstrumentalPlaceholder(lineText(line))
      ) {
        backgroundLines.push(line);
      }
    }
    lyricLines.value = visibleMainLines;
    backgroundLyricLines.value = backgroundLines;
  } catch {
    // 歌词预览失败不影响识曲候选本身
  } finally {
    if (token === loadToken) lyricLoading.value = false;
  }
};

watch(
  [() => props.result.track.id, () => settings.locale, () => settings.lyric.detectBackgroundLyrics],
  () => void loadLyric(),
  { immediate: true },
);

onBeforeUnmount(() => {
  loadToken += 1;
});

const activeIndex = computed(() => {
  if (props.currentTime === null) return -1;
  return pickLatestStartedIndex(lyricLines.value, props.currentTime);
});

const activeBackgroundLine = computed<LyricLine | null>(() => {
  if (props.currentTime === null) return null;
  const index = pickLatestActiveIndex(backgroundLyricLines.value, props.currentTime);
  return index < 0 ? null : (backgroundLyricLines.value[index] ?? null);
});

const visibleLines = computed(() => {
  if (lyricLines.value.length === 0) return [];
  const center = Math.max(0, activeIndex.value);
  const start = Math.max(0, center - 2);
  const end = Math.min(lyricLines.value.length, center + 3);
  return lyricLines.value.slice(start, end).map((line, offset) => {
    const index = start + offset;
    return { line, index, distance: index - center };
  });
});

const matchedTime = computed(() =>
  props.result.startTime === null ? "" : formatTime(props.result.startTime),
);
const currentTimeText = computed(() =>
  props.currentTime === null ? "" : formatTime(props.currentTime),
);
const showLyricPanel = computed(() => lyricLoading.value || lyricLines.value.length > 0);

/** 跳转至候选歌曲的歌手页 */
const goArtist = (index: number): void => {
  const artist = props.result.track.artists[index];
  if (!artist?.id) return;
  navigateToArtist(artist.name, { source: props.result.track.source, artistId: artist.id });
};

/** 跳转至候选歌曲的专辑页 */
const goAlbum = (): void => {
  const album = props.result.track.album;
  if (!album?.id) return;
  navigateToAlbum(album.name, { source: props.result.track.source, albumId: album.id });
};
</script>

<template>
  <article
    class="group overflow-hidden rounded-xl border-2 border-solid bg-surface-panel transition-[background-color,border-color] duration-200"
    :class="
      playing
        ? 'border-primary/40 bg-primary/10'
        : 'border-primary/12 hover:border-primary/25 hover:bg-on-surface/[0.025]'
    "
  >
    <div class="flex items-center gap-3 px-4 pt-3" :class="{ 'pb-3': !showLyricPanel }">
      <span
        class="w-6 shrink-0 text-center text-sm font-bold tabular-nums"
        :class="playing ? 'text-primary' : 'text-on-surface-variant/55'"
      >
        {{ index + 1 }}
      </span>
      <button
        type="button"
        class="relative grid size-14 shrink-0 cursor-pointer place-items-stretch overflow-hidden rounded-lg border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
        :title="t('audioRecognition.play')"
        :aria-label="t('audioRecognition.play')"
        @click="emit('play')"
      >
        <SImg :src="result.track.cover" class="size-full" />
        <span
          class="absolute inset-0 flex items-center justify-center bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <IconLucidePlay class="size-5 fill-current" />
        </span>
      </button>

      <div class="min-w-0 flex-1">
        <div class="truncate text-base font-medium" :class="playing ? 'text-primary' : ''">
          {{ result.track.title }}
        </div>
        <div class="mt-1 flex min-w-0 items-center gap-1 text-sm text-on-surface-variant/65">
          <span class="min-w-0 truncate">
            <template
              v-for="(artist, artistIndex) in result.track.artists"
              :key="artist.id ?? artistIndex"
            >
              <button
                type="button"
                class="cursor-pointer border-0 bg-transparent p-0 text-left text-inherit transition-colors hover:text-on-surface disabled:cursor-default disabled:hover:text-inherit"
                :disabled="!artist.id"
                @click.stop="goArtist(artistIndex)"
              >
                {{ artist.name }}
              </button>
              <span v-if="artistIndex < result.track.artists.length - 1" class="mx-0.5 opacity-50">
                /
              </span>
            </template>
          </span>
          <span v-if="result.track.album?.name" class="shrink-0 opacity-35">·</span>
          <button
            v-if="result.track.album?.name"
            type="button"
            class="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-inherit transition-colors hover:text-on-surface disabled:cursor-default disabled:hover:text-inherit"
            :disabled="!result.track.album.id"
            @click.stop="goAlbum"
          >
            {{ result.track.album.name }}
          </button>
        </div>
      </div>

      <div
        v-if="result.startTime !== null"
        class="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
      >
        <IconLucideScanLine class="size-3.5" />
        {{ t("audioRecognition.matchedAt", { time: matchedTime }) }}
      </div>
    </div>

    <div
      v-if="showLyricPanel"
      class="mx-4 mb-3 mt-2 overflow-hidden rounded-lg bg-on-surface/[0.035] px-4"
    >
      <div
        v-if="lyricLoading"
        class="flex h-30 items-center justify-center gap-2 text-sm text-on-surface-variant/50"
      >
        <IconLucideLoaderCircle class="size-4 animate-spin" />
        {{ t("audioRecognition.lyricLoading") }}
      </div>
      <div v-else class="relative h-30 overflow-hidden">
        <TransitionGroup name="recognition-lyric">
          <div
            v-for="item in visibleLines"
            :key="`${item.line.startTime}:${item.index}`"
            class="recognition-lyric-line absolute inset-x-0 -translate-y-1/2 text-center"
            :class="item.index === activeIndex ? 'text-on-surface' : 'text-on-surface-variant/30'"
            :style="{
              top: `calc(50% + ${item.distance * 42}px)`,
              opacity: item.index === activeIndex ? 1 : Math.abs(item.distance) === 1 ? 0.58 : 0.28,
            }"
          >
            <div class="flex min-w-0 items-center justify-center">
              <Transition name="recognition-background" mode="out-in">
                <div
                  v-if="item.index === activeIndex && activeBackgroundLine"
                  :key="activeBackgroundLine.startTime"
                  class="recognition-background-wrap flex min-w-0 items-center gap-2"
                >
                  <div class="min-w-0 text-right text-sm font-medium text-on-surface-variant/65">
                    <AudioRecognitionLyricText
                      :line="activeBackgroundLine"
                      :current-time="currentTime"
                      :progressing="progressing"
                      :rate="rate"
                    />
                    <div
                      v-if="activeBackgroundLine.translatedLyric"
                      class="recognition-translation mt-0.5 truncate text-xs opacity-55"
                    >
                      {{ activeBackgroundLine.translatedLyric }}
                    </div>
                  </div>
                  <span
                    class="h-7 w-px shrink-0 rounded-full bg-on-surface-variant/20"
                    aria-hidden="true"
                  />
                </div>
              </Transition>

              <div
                class="recognition-main-wrap min-w-0 transition-[max-width] duration-300"
                :class="
                  item.index === activeIndex && activeBackgroundLine
                    ? 'max-w-[60%] text-left'
                    : 'max-w-full text-center'
                "
              >
                <div
                  class="recognition-main-text"
                  :style="{
                    fontSize: item.index === activeIndex ? '1rem' : '0.875rem',
                    lineHeight: item.index === activeIndex ? '1.5rem' : '1.25rem',
                    fontWeight: item.index === activeIndex ? 600 : 400,
                  }"
                >
                  <AudioRecognitionLyricText
                    :line="item.line"
                    :current-time="item.index === activeIndex ? currentTime : null"
                    :progressing="progressing"
                    :rate="rate"
                    :word-by-word="item.index === activeIndex"
                  />
                </div>
                <div
                  v-if="item.line.translatedLyric"
                  class="recognition-translation mt-0.5 truncate text-xs"
                  :class="item.index === activeIndex ? 'opacity-55' : 'opacity-40'"
                >
                  {{ item.line.translatedLyric }}
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
        <span class="absolute bottom-2 right-0 text-[11px] tabular-nums text-on-surface-variant/35">
          {{ currentTimeText }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.recognition-lyric-line {
  transition:
    top 520ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 380ms ease,
    color 380ms ease;
}

.recognition-main-text,
.recognition-translation {
  transition:
    font-size 480ms cubic-bezier(0.4, 0, 0.2, 1),
    line-height 480ms cubic-bezier(0.4, 0, 0.2, 1),
    font-weight 400ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 320ms ease;
}

.recognition-lyric-enter-active,
.recognition-lyric-leave-active {
  transition:
    opacity 300ms ease,
    translate 420ms cubic-bezier(0.22, 1, 0.36, 1),
    scale 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.recognition-lyric-enter-from {
  opacity: 0 !important;
  translate: 0 0.35rem;
  scale: 0.98;
}

.recognition-lyric-leave-to {
  opacity: 0 !important;
  translate: 0 -0.35rem;
  scale: 0.98;
}

.recognition-background-wrap {
  max-width: 40%;
  margin-right: 0.5rem;
  overflow: hidden;
}

.recognition-background-enter-active,
.recognition-background-leave-active {
  transition:
    max-width 300ms cubic-bezier(0.2, 0.7, 0.2, 1),
    margin-right 300ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 220ms ease,
    transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1);
}

.recognition-background-enter-from,
.recognition-background-leave-to {
  max-width: 0;
  margin-right: 0;
  opacity: 0;
  transform: translateX(0.5rem);
}
</style>
