<script setup lang="ts">
import type { InputContextMenuContext } from "@/components/ui/SInput.vue";
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import IconLucideSearch from "~icons/lucide/search";

defineProps<{
  /** 输入值 */
  modelValue: string;
  /** 占位文案 */
  placeholder: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  keydown: [event: KeyboardEvent];
  search: [value: string];
}>();

const { t } = useI18n();

const menuItems = computed<DropdownMenuItem[]>(() => [
  {
    key: "pasteSearch",
    label: t("nav.searchMenu.pasteSearch"),
    icon: markRaw(IconLucideSearch),
    separator: true,
  },
]);

/**
 * 粘贴剪贴板内容并立即搜索
 * @param key - 自定义菜单项键值
 * @param context - 输入框编辑上下文
 */
const onContextMenuSelect = async (
  key: string,
  context: InputContextMenuContext,
): Promise<void> => {
  if (key !== "pasteSearch") return;
  const value = await context.paste(false);
  if (value !== undefined) emit("search", value);
};
</script>

<template>
  <SInput
    :model-value="modelValue"
    :placeholder="placeholder"
    :context-menu-items="menuItems"
    size="large"
    clearable
    @update:model-value="emit('update:modelValue', $event)"
    @context-menu-select="onContextMenuSelect"
    @keydown="emit('keydown', $event)"
  >
    <template #prefix>
      <IconLucideSearch class="size-4 text-on-surface-variant/50 shrink-0" />
    </template>
  </SInput>
</template>
