import type { DropdownMenuItem } from "@/components/ui/SDropdownMenu.vue";
import { toast } from "@/composables/useToast";
import IconLucideCopy from "~icons/lucide/copy";
import IconLucideImage from "~icons/lucide/image";
import IconLucideSave from "~icons/lucide/save";

/**
 * 获取图片右键操作
 */
export const useImageActions = () => {
  const { t } = useI18n();
  const processing = ref(false);
  const menuItems = computed<DropdownMenuItem[]>(() => [
    {
      key: "open",
      label: t("follow.imageMenu.open"),
      icon: markRaw(IconLucideImage),
      disabled: processing.value,
    },
    {
      key: "copy",
      label: t("follow.imageMenu.copy"),
      icon: markRaw(IconLucideCopy),
      disabled: processing.value,
    },
    {
      key: "saveAs",
      label: t("follow.imageMenu.saveAs"),
      icon: markRaw(IconLucideSave),
      disabled: processing.value,
    },
  ]);

  const resolveFileName = (url: string): string => {
    try {
      const name = decodeURIComponent(
        new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "",
      );
      return /\.(?:jpe?g|png|webp|gif|bmp)$/i.test(name) ? name : "image.png";
    } catch {
      return "image.png";
    }
  };

  const fetchImage = async (url: string): Promise<ArrayBuffer> => {
    const result = await window.api.system.fetchRemoteBytes(url);
    if (!result.success || !result.data) throw new Error(t("follow.imageMenu.loadFailed"));
    return Uint8Array.from(new Uint8Array(result.data)).buffer;
  };

  /**
   * 执行图片右键操作
   * @param action - 操作名称
   * @param url - 图片地址
   */
  const handleAction = async (action: string, url: string): Promise<void> => {
    if (processing.value || !url) return;
    processing.value = true;
    try {
      const data = await fetchImage(url);
      const fileName = resolveFileName(url);
      if (action === "open") {
        const result = await window.api.system.openImage(data, fileName);
        if (!result.success) throw new Error(result.error || t("follow.imageMenu.openFailed"));
      } else if (action === "copy") {
        const result = await window.api.system.copyImage(data);
        if (!result.success) throw new Error(result.error || t("follow.imageMenu.copyFailed"));
        toast.success(t("follow.imageMenu.copyDone"));
      } else if (action === "saveAs") {
        const result = await window.api.system.saveFileAs(data, fileName);
        if (result.canceled) return;
        if (!result.success) throw new Error(result.error || t("follow.imageMenu.saveFailed"));
        toast.success(t("follow.imageMenu.saveDone"));
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      processing.value = false;
    }
  };

  return { menuItems, handleAction };
};
