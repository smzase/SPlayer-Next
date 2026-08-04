<script setup lang="ts">
import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import { toast } from "@/composables/useToast";
import IconLucideClipboardPaste from "~icons/lucide/clipboard-paste";
import IconLucideCopy from "~icons/lucide/copy";
import IconLucideScissors from "~icons/lucide/scissors";
import IconLucideTextCursorInput from "~icons/lucide/text-cursor-input";
import IconLucideTrash2 from "~icons/lucide/trash-2";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

export interface InputContextMenuContext {
  paste: (restoreFocus?: boolean) => Promise<string | undefined>;
}

export interface SInputProps {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 只读：保留聚焦/事件，仅禁用键入 */
  readonly?: boolean;
  clearable?: boolean;
  round?: boolean;
  type?: "text" | "password" | "email" | "number" | "url" | "search" | "tel" | "textarea";
  /** 多行行数 */
  rows?: number;
  /** 最大输入字符数 */
  maxlength?: number;
  /** 是否显示原生缩放手柄 */
  resize?: "none" | "vertical" | "horizontal" | "both";
  /** 尺寸 */
  size?: "small" | "medium" | "large";
  /** 状态色（错误等） */
  status?: "default" | "error";
  /** 更新时机：input 立即更新；blur 在失焦或回车时提交 */
  updateOn?: "input" | "blur";
  /** 追加到文本编辑菜单末尾的自定义项目 */
  contextMenuItems?: DropdownMenuItem[];
}

const props = withDefaults(defineProps<SInputProps>(), {
  modelValue: "",
  placeholder: "",
  disabled: false,
  readonly: false,
  clearable: false,
  round: false,
  type: "text",
  rows: 3,
  resize: "none",
  size: "medium",
  status: "default",
  updateOn: "input",
});

const isTextarea = computed(() => props.type === "textarea");

const resizeClass = computed(() => {
  switch (props.resize) {
    case "vertical":
      return "resize-y";
    case "horizontal":
      return "resize-x";
    case "both":
      return "resize";
    default:
      return "resize-none";
  }
});

const sizeClasses = computed(() => {
  if (isTextarea.value) {
    // 多行容器不限定高度，仅设字号 + 内边距
    if (props.size === "small") return "px-2 py-1.5 text-xs";
    if (props.size === "large") return "px-4 py-2.5 text-base";
    return "px-3 py-2 text-sm";
  }
  if (props.size === "small") return "h-8 px-2 text-xs";
  if (props.size === "large") return "h-10 px-4 text-base";
  return "h-9 px-3 text-sm";
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  focus: [];
  blur: [];
  contextMenuSelect: [key: string, context: InputContextMenuContext];
}>();

const { t } = useI18n();
const isFocused = ref(false);
const draftValue = ref(props.modelValue);
const displayValue = computed(() =>
  props.updateOn === "blur" ? draftValue.value : props.modelValue,
);
const showClear = computed(
  () => props.clearable && displayValue.value.length > 0 && !props.disabled,
);
const editTarget = shallowRef<EditableElement | null>(null);
const editSelection = ref({ start: 0, end: 0 });
const editValue = ref("");
let isContextMenuActive = false;
let restoreSelectionAfterClose = false;
let selectionRestoreFrame: number | undefined;
const selectedText = computed(() =>
  editValue.value.slice(editSelection.value.start, editSelection.value.end),
);
const canEdit = computed(
  () => !!editTarget.value && !editTarget.value.disabled && !editTarget.value.readOnly,
);
const contextMenuItems = computed<DropdownMenuItem[]>(() => [
  {
    key: "cut",
    label: t("inputMenu.cut"),
    icon: markRaw(IconLucideScissors),
    disabled: !canEdit.value || !selectedText.value,
  },
  {
    key: "copy",
    label: t("inputMenu.copy"),
    icon: markRaw(IconLucideCopy),
    disabled: !selectedText.value,
  },
  {
    key: "paste",
    label: t("inputMenu.paste"),
    icon: markRaw(IconLucideClipboardPaste),
    disabled: !canEdit.value,
  },
  {
    key: "delete",
    label: t("inputMenu.delete"),
    icon: markRaw(IconLucideTrash2),
    disabled: !canEdit.value || !selectedText.value,
  },
  {
    key: "selectAll",
    label: t("inputMenu.selectAll"),
    icon: markRaw(IconLucideTextCursorInput),
    disabled: !editValue.value,
  },
  ...(props.contextMenuItems ?? []),
]);

watch(
  () => props.modelValue,
  (value) => {
    if (props.updateOn === "input" || !isFocused.value) draftValue.value = value;
  },
);

const commitValue = (): void => {
  if (draftValue.value !== props.modelValue) emit("update:modelValue", draftValue.value);
};

const rollbackValue = (): void => {
  draftValue.value = props.modelValue;
};

const handleInput = (value: string): void => {
  if (props.updateOn === "input") {
    emit("update:modelValue", value);
    return;
  }
  draftValue.value = value;
};

const handleClear = () => {
  handleInput("");
};

const handleBlur = (): void => {
  isFocused.value = false;
  if (props.updateOn === "blur") commitValue();
  emit("blur");
};

const handleEnter = (event: KeyboardEvent): void => {
  if (props.updateOn !== "blur") return;
  commitValue();
  (event.currentTarget as HTMLInputElement).blur();
};

const handleEscape = (event: KeyboardEvent): void => {
  if (props.updateOn !== "blur") return;
  rollbackValue();
  (event.currentTarget as HTMLInputElement).blur();
};

const handleContextMenu = (event: MouseEvent): void => {
  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  if (selectionRestoreFrame !== undefined) {
    cancelAnimationFrame(selectionRestoreFrame);
    selectionRestoreFrame = undefined;
  }
  isContextMenuActive = true;
  restoreSelectionAfterClose = false;
  editTarget.value = target;
  editValue.value = target.value;
  try {
    editSelection.value = {
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    };
  } catch {
    editSelection.value = { start: target.value.length, end: target.value.length };
  }
};

const restoreSelection = (): void => {
  const target = editTarget.value;
  if (!target) return;
  if (selectionRestoreFrame !== undefined) cancelAnimationFrame(selectionRestoreFrame);
  selectionRestoreFrame = requestAnimationFrame(() => {
    selectionRestoreFrame = undefined;
    target.focus({ preventScroll: true });
    try {
      target.setSelectionRange(editSelection.value.start, editSelection.value.end);
    } catch {
      // 数字输入框不支持程序化选区
    }
  });
};

const focusSelection = (start: number, end = start): void => {
  editSelection.value = { start, end };
  restoreSelectionAfterClose = true;
  if (!isContextMenuActive) restoreSelection();
};

const handleContextMenuClosed = (): void => {
  isContextMenuActive = false;
  if (!restoreSelectionAfterClose) return;
  restoreSelectionAfterClose = false;
  restoreSelection();
};

const replaceSelection = (replacement: string, restoreFocus = true): string | undefined => {
  const target = editTarget.value;
  if (!target || !canEdit.value) return undefined;
  const { start, end } = editSelection.value;
  const available =
    props.maxlength === undefined
      ? replacement.length
      : Math.max(0, props.maxlength - (editValue.value.length - (end - start)));
  const inserted = replacement.slice(0, available);
  target.value = `${editValue.value.slice(0, start)}${inserted}${editValue.value.slice(end)}`;
  target.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  editValue.value = target.value;
  const caret = Math.min(target.value.length, start + inserted.length);
  editSelection.value = { start: caret, end: caret };
  if (restoreFocus) focusSelection(caret);
  return target.value;
};

const copySelection = async (notify = true): Promise<boolean> => {
  if (!selectedText.value) return false;
  try {
    await navigator.clipboard.writeText(selectedText.value);
    if (notify) toast.success(t("common.copied"));
    return true;
  } catch {
    toast.error(t("common.copyFailed"));
    return false;
  }
};

const paste = async (restoreFocus = true): Promise<string | undefined> => {
  if (!canEdit.value) return undefined;
  if (!restoreFocus) restoreSelectionAfterClose = false;
  try {
    return replaceSelection(await navigator.clipboard.readText(), restoreFocus);
  } catch {
    toast.error(t("inputMenu.pasteFailed"));
    return undefined;
  }
};

const selectAll = (): void => {
  const target = editTarget.value;
  if (!target) return;
  editSelection.value = { start: 0, end: target.value.length };
  focusSelection(0, target.value.length);
};

const handleContextMenuSelect = async (key: string): Promise<void> => {
  if (["cut", "copy", "paste", "delete", "selectAll"].includes(key)) {
    restoreSelectionAfterClose = true;
  }
  if (key === "cut") {
    if (await copySelection(false)) replaceSelection("");
  } else if (key === "copy") {
    await copySelection();
  } else if (key === "paste") {
    await paste();
  } else if (key === "delete") {
    replaceSelection("");
  } else if (key === "selectAll") {
    selectAll();
  } else {
    emit("contextMenuSelect", key, { paste });
  }
};

onBeforeUnmount(() => {
  if (selectionRestoreFrame !== undefined) cancelAnimationFrame(selectionRestoreFrame);
});
</script>

<template>
  <div
    class="text-on-surface border border-solid transition-[border-color,box-shadow,background-color,width,opacity] duration-250"
    :class="[
      isTextarea ? 'relative block' : 'flex items-center gap-2',
      sizeClasses,
      round ? 'rounded-full' : 'rounded-lg',
      isFocused
        ? status === 'error'
          ? 'bg-on-surface/8 border-red-500 ring-2 ring-red-500/20'
          : 'bg-on-surface/8 border-primary ring-2 ring-primary/20'
        : status === 'error'
          ? 'bg-on-surface/3 border-red-500/60 hover:bg-on-surface/10'
          : 'bg-on-surface/3 border-on-surface/15 hover:bg-on-surface/10 hover:border-on-surface/25',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ]"
  >
    <!-- 多行 -->
    <template v-if="isTextarea">
      <div class="contents" @contextmenu.stop>
        <SContextMenu
          :items="contextMenuItems"
          preserve-focus
          @closed="handleContextMenuClosed"
          @select="handleContextMenuSelect"
        >
          <textarea
            :value="displayValue"
            :placeholder="placeholder"
            :disabled="disabled"
            :readonly="readonly"
            :rows="rows"
            :maxlength="maxlength"
            class="w-full block bg-transparent outline-none border-none shadow-none text-on-surface placeholder:text-on-surface-variant/40 disabled:cursor-not-allowed"
            :class="[resizeClass, readonly ? 'cursor-pointer' : '', showClear ? 'pr-5' : '']"
            @input="handleInput(($event.target as HTMLTextAreaElement).value)"
            @focus="
              isFocused = true;
              emit('focus');
            "
            @blur="handleBlur"
            @keydown.esc="handleEscape"
            @contextmenu.capture="handleContextMenu"
          />
        </SContextMenu>
      </div>
      <!-- 清空按钮（textarea 模式右上角浮动） -->
      <Transition name="fade">
        <IconLucideX
          v-if="showClear"
          class="absolute top-2 right-2 size-3.5 text-on-surface-variant/50 cursor-pointer transition-colors duration-200 hover:text-on-surface"
          @mousedown.prevent.stop="handleClear"
        />
      </Transition>
    </template>

    <template v-else>
      <!-- 前置插槽 -->
      <slot name="prefix" />

      <div class="contents" @contextmenu.stop>
        <SContextMenu
          :items="contextMenuItems"
          preserve-focus
          @closed="handleContextMenuClosed"
          @select="handleContextMenuSelect"
        >
          <input
            :value="displayValue"
            :type="type"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :disabled="disabled"
            :readonly="readonly"
            class="flex-1 min-w-0 h-full bg-transparent outline-none border-none shadow-none text-on-surface placeholder:text-on-surface-variant/40 disabled:cursor-not-allowed"
            :class="readonly ? 'cursor-pointer' : ''"
            @input="handleInput(($event.target as HTMLInputElement).value)"
            @focus="
              isFocused = true;
              emit('focus');
            "
            @blur="handleBlur"
            @keydown.enter="handleEnter"
            @keydown.esc="handleEscape"
            @contextmenu.capture="handleContextMenu"
          />
        </SContextMenu>
      </div>

      <!-- 清空按钮：mousedown.prevent 保留输入焦点，避免触发 blur 让 focus-within 宽度回缩导致点击错位 -->
      <Transition name="fade">
        <IconLucideX
          v-if="showClear"
          class="size-3.5 text-on-surface-variant/50 shrink-0 cursor-pointer transition-colors duration-200 hover:text-on-surface"
          @mousedown.prevent.stop="handleClear"
        />
      </Transition>

      <!-- 后置插槽 -->
      <slot name="suffix" />
    </template>
  </div>
</template>
