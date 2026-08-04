<script setup lang="ts">
import { openExternal } from "@/utils/url";

const props = defineProps<{
  text: string;
}>();

interface TextPart {
  type: "text" | "topic" | "mention" | "link";
  value: string;
}

const parts = computed<TextPart[]>(() => {
  const result: TextPart[] = [];
  const pattern = /(https?:\/\/[^\s]+|#[^#\r\n]+#|@[\u4e00-\u9fa5A-Za-z0-9_-]{2,})/g;
  let offset = 0;
  for (const match of props.text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) result.push({ type: "text", value: props.text.slice(offset, index) });
    const value = match[0];
    result.push({
      type: value.startsWith("http") ? "link" : value.startsWith("#") ? "topic" : "mention",
      value,
    });
    offset = index + value.length;
  }
  if (offset < props.text.length) {
    result.push({ type: "text", value: props.text.slice(offset) });
  }
  return result;
});
</script>

<template>
  <p class="whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">
    <template v-for="(part, index) in parts" :key="`${index}-${part.value}`">
      <button
        v-if="part.type === 'link'"
        class="cursor-pointer border-0 bg-transparent p-0 text-left text-primary hover:underline"
        @click.stop="openExternal(part.value)"
      >
        {{ part.value }}
      </button>
      <span v-else-if="part.type !== 'text'" class="text-primary">{{ part.value }}</span>
      <template v-else>{{ part.value }}</template>
    </template>
  </p>
</template>
