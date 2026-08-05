<script setup lang="ts">
import { openExternal } from "@/utils/url";
import { searchMentionUsers } from "@/apis/follow/netease";
import { toast } from "@/composables/useToast";

const props = defineProps<{
  text: string;
}>();

const emit = defineEmits<{
  navigate: [];
}>();

const { t } = useI18n();
const router = useRouter();
const openingMention = ref(false);

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

const openMention = async (value: string): Promise<void> => {
  if (openingMention.value || window.getSelection()?.toString()) return;
  const nickname = value.slice(1);
  openingMention.value = true;
  try {
    const users = await searchMentionUsers(nickname);
    const user =
      users.find(
        (item) => item.name.localeCompare(nickname, undefined, { sensitivity: "base" }) === 0,
      ) ?? users[0];
    if (!user) {
      toast.warning(t("follow.composer.noUsers"));
      return;
    }
    emit("navigate");
    await router.push({ name: "user-profile", params: { uid: user.id } });
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    openingMention.value = false;
  }
};
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
      <button
        v-else-if="part.type === 'mention'"
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 text-left text-primary select-text hover:underline"
        @click.stop="openMention(part.value)"
      >
        {{ part.value }}
      </button>
      <span v-else-if="part.type === 'topic'" class="text-primary">{{ part.value }}</span>
      <template v-else>{{ part.value }}</template>
    </template>
  </p>
</template>
