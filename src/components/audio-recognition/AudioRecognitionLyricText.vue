<script setup lang="ts">
import type { LyricLine } from "@shared/types/lyrics";
import { getWordSweepProgress, hasRealWordTiming } from "@shared/utils/lyricSync";

const props = withDefaults(
  defineProps<{
    line: LyricLine;
    currentTime: number | null;
    progressing?: boolean;
    rate?: number;
    wordByWord?: boolean;
  }>(),
  {
    progressing: true,
    rate: 1,
    wordByWord: true,
  },
);

const useKaraoke = computed(
  () => props.wordByWord && props.currentTime !== null && hasRealWordTiming(props.line),
);
const plainText = computed(() =>
  props.line.words
    .map((word) => word.word)
    .join("")
    .trim(),
);
const wordRefs: HTMLSpanElement[] = [];

let anchorTime = 0;
let anchorPerf = 0;
let rafId = 0;
let lastWordProgress: string[] = [];

const setWordRef = (el: Element | { $el?: Element } | null, index: number): void => {
  const target = el instanceof Element ? el : (el?.$el ?? null);
  if (target instanceof HTMLSpanElement) {
    wordRefs[index] = target;
  } else {
    delete wordRefs[index];
  }
};

const getWordProgress = (index: number, currentMs: number): string => {
  const progress = getWordSweepProgress(props.line.words[index], props.line.startTime, currentMs);
  const pct = (progress * 100).toFixed(1);
  const edge = progress * 4 - 2;
  const signed = edge >= 0 ? `+ ${edge.toFixed(2)}px` : `- ${(-edge).toFixed(2)}px`;
  return `calc(${pct}% ${signed})`;
};

const renderWords = (currentMs: number): void => {
  for (let index = 0; index < props.line.words.length; index++) {
    const element = wordRefs[index];
    if (!element) continue;
    const progress = getWordProgress(index, currentMs);
    if (lastWordProgress[index] === progress) continue;
    lastWordProgress[index] = progress;
    element.style.setProperty("--recognition-word-progress", progress);
  }
};

const stopRenderLoop = (): void => {
  if (rafId === 0) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
};

const tick = (): void => {
  rafId = 0;
  if (!useKaraoke.value || document.hidden) return;
  const currentMs =
    anchorTime + (props.progressing ? (performance.now() - anchorPerf) * props.rate : 0);
  renderWords(currentMs);
  if (props.progressing) rafId = requestAnimationFrame(tick);
};

const syncAnchor = (): void => {
  anchorTime = props.currentTime ?? 0;
  anchorPerf = performance.now();
  if (!useKaraoke.value || document.hidden) {
    stopRenderLoop();
    return;
  }
  renderWords(anchorTime);
  if (props.progressing && rafId === 0) rafId = requestAnimationFrame(tick);
};

watch(() => [props.currentTime, props.progressing, props.rate] as const, syncAnchor);
watch(
  () => props.line,
  () => {
    lastWordProgress = [];
    wordRefs.length = 0;
    nextTick(syncAnchor);
  },
);
watch(useKaraoke, (enabled) => {
  if (enabled) nextTick(syncAnchor);
  else stopRenderLoop();
});

const handleVisibilityChange = (): void => {
  if (document.hidden) stopRenderLoop();
  else syncAnchor();
};

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  syncAnchor();
});

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  stopRenderLoop();
});
</script>

<template>
  <span class="recognition-lyric-text block truncate">
    <template v-if="useKaraoke">
      <span
        v-for="(word, index) in line.words"
        :key="`${word.startTime}:${index}`"
        :ref="(element) => setWordRef(element, index)"
        class="recognition-word"
      >
        <span class="recognition-word-unplayed">{{ word.word }}</span>
        <span class="recognition-word-played" aria-hidden="true">{{ word.word }}</span>
      </span>
    </template>
    <span v-else>{{ plainText }}</span>
  </span>
</template>

<style scoped>
.recognition-lyric-text {
  white-space: pre;
}

.recognition-word {
  --recognition-word-progress: 0%;
  display: inline-grid;
}

.recognition-word-unplayed,
.recognition-word-played {
  grid-area: 1 / 1;
  font: inherit;
  white-space: pre;
}

.recognition-word-unplayed {
  color: color-mix(in srgb, currentColor 30%, transparent);
}

.recognition-word-played {
  color: currentColor;
  clip-path: inset(0 calc(100% - var(--recognition-word-progress)) 0 0);
}
</style>
