<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open?: boolean;
    disabled?: boolean;
    title: string;
  }>(),
  {
    open: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  select: [emoji: string];
}>();

const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😝",
  "😜",
  "🤪",
  "🤨",
  "🧐",
  "🤓",
  "😎",
  "🥸",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😞",
  "😔",
  "😟",
  "😕",
  "🙁",
  "☹️",
  "😣",
  "😖",
  "😫",
  "😩",
  "🥺",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥵",
  "🥶",
  "😱",
  "😨",
  "😰",
  "😥",
  "😓",
  "🤗",
  "🤔",
  "🫣",
  "🤭",
  "🫢",
  "🫡",
  "🤫",
  "🤥",
  "😶",
  "😐",
  "😑",
  "😬",
  "🙄",
  "😯",
  "😦",
  "😧",
  "😮",
  "😲",
  "🥱",
  "😴",
  "🤤",
  "😪",
  "😵",
  "🤐",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤒",
  "🤕",
  "👍",
  "👎",
  "👌",
  "🤌",
  "🤏",
  "✌️",
  "🤞",
  "🫰",
  "🤟",
  "🤘",
  "🤙",
  "👈",
  "👉",
  "👆",
  "👇",
  "☝️",
  "✋",
  "🤚",
  "🖐️",
  "🖖",
  "👋",
  "🤝",
  "👏",
  "🙌",
  "🫶",
  "🙏",
  "💪",
  "✍️",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "🤎",
  "💔",
  "❤️‍🔥",
  "❤️‍🩹",
  "❣️",
  "💕",
  "💞",
  "💓",
  "💗",
  "💖",
  "💘",
  "💝",
  "💟",
  "🔥",
  "✨",
  "⭐",
  "🌟",
  "💫",
  "🎉",
  "🎊",
  "🎵",
  "🎶",
  "🎧",
  "🌹",
  "🌸",
  "🌈",
  "☀️",
  "🌙",
  "🍀",
  "☕",
  "🍻",
  "🎂",
  "🎁",
] as const;

const selectEmoji = (emoji: string): void => {
  emit("select", emoji);
  emit("update:open", false);
};
</script>

<template>
  <SPopover
    :open="props.open"
    side="top"
    align="start"
    :side-offset="8"
    @update:open="emit('update:open', $event)"
  >
    <template #trigger>
      <SButton
        variant="ghost"
        size="small"
        circle
        :title="title"
        :aria-label="title"
        :disabled="disabled"
      >
        <template #icon><IconLucideSmilePlus /></template>
      </SButton>
    </template>
    <div class="grid max-h-64 w-72 grid-cols-9 gap-1 overflow-y-auto pr-1">
      <button
        v-for="emoji in EMOJIS"
        :key="emoji"
        type="button"
        class="emoji-picker-button flex size-7 cursor-pointer items-center justify-center rounded-md text-lg focus-visible:ring-2 focus-visible:ring-primary/40"
        :aria-label="emoji"
        @click="selectEmoji(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </SPopover>
</template>

<style scoped>
.emoji-picker-button {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  line-height: 1;
  transition:
    color 150ms,
    background-color 150ms,
    transform 150ms;
}

.emoji-picker-button:hover {
  background-color: rgb(var(--s-on-surface) / 0.12);
  transform: scale(1.12);
}

.emoji-picker-button:active {
  background-color: rgb(var(--s-primary) / 0.18);
  transform: scale(0.9);
}
</style>
