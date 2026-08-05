<script setup lang="ts">
import type { DownloadTask, DownloadStatus } from "@shared/types/download";
import type { TabItem } from "@/components/ui/STabs.vue";
import { useDownloadStore } from "@/stores/download";
import { dialog } from "@/composables/useDialog";
import DownloadList from "@/components/list/DownloadList.vue";
import IconLucidePlay from "~icons/lucide/play";
import IconLucideTrash2 from "~icons/lucide/trash-2";
import IconLucideX from "~icons/lucide/x";
import IconLucideMusic from "~icons/lucide/music";
import IconLucideDownload from "~icons/lucide/download";

const { t } = useI18n();
const downloadStore = useDownloadStore();

type DownloadTab = "all" | "active" | "queued" | "error" | "done";
const tab = ref<DownloadTab>("all");

const tabs = computed<TabItem[]>(() => [
  { key: "all", label: t("download.tabAll") },
  { key: "active", label: t("download.tabActive") },
  { key: "queued", label: t("download.tabQueued") },
  { key: "error", label: t("download.tabError") },
  { key: "done", label: t("download.tabDone") },
]);

const isOngoing = (status: DownloadStatus): boolean =>
  status === "queued" || status === "downloading";
const isError = (status: DownloadStatus): boolean =>
  status === "failed" || status === "canceled" || status === "interrupted";

/** 当前 tab 的任务 */
const currentTasks = computed<DownloadTask[]>(() => {
  const all = [...downloadStore.tasks].sort((a, b) => {
    const priority = (status: DownloadStatus): number =>
      status === "downloading" ? 0 : status === "queued" ? 1 : 2;
    const priorityDelta = priority(a.status) - priority(b.status);
    if (priorityDelta !== 0) return priorityDelta;
    if (a.status === "queued" && b.status === "queued") return a.createdAt - b.createdAt;
    return b.createdAt - a.createdAt;
  });
  if (tab.value === "active") return all.filter((task) => task.status === "downloading");
  if (tab.value === "queued") return all.filter((task) => task.status === "queued");
  if (tab.value === "error") return all.filter((task) => isError(task.status));
  if (tab.value === "done") return all.filter((task) => task.status === "done");
  return all;
});

/** 是否有可清空的已结束任务 */
const hasFinished = computed(() => downloadStore.tasks.some((task) => !isOngoing(task.status)));

const headerAction = computed(() => {
  if (tab.value === "active") {
    return {
      label: t("download.cancelActive"),
      icon: IconLucideX,
      disabled: currentTasks.value.length === 0,
    };
  }
  if (tab.value === "queued" || tab.value === "error") {
    return {
      label: t("download.clearQueue"),
      icon: IconLucideTrash2,
      disabled: currentTasks.value.length === 0,
    };
  }
  return {
    label: t("download.clearFinished"),
    icon: IconLucideTrash2,
    disabled: !hasFinished.value,
  };
});

/** 二次确认后执行当前分页对应的批量任务操作 */
const requestHeaderAction = async (): Promise<void> => {
  if (tab.value === "active") {
    const confirmed = await dialog.confirm({
      title: t("download.cancelActiveTitle"),
      content: t("download.cancelActiveConfirm", { count: currentTasks.value.length }),
      confirmText: t("download.cancelActive"),
      type: "warning",
    });
    if (confirmed) {
      downloadStore.cancelMany(currentTasks.value.map((task) => task.taskId));
    }
    return;
  }

  if (tab.value === "queued" || tab.value === "error") {
    const confirmed = await dialog.confirm({
      title: t("download.clearQueueTitle"),
      content: t("download.clearQueueConfirm", { count: currentTasks.value.length }),
      confirmText: t("download.clearQueue"),
      type: "warning",
    });
    if (confirmed) {
      downloadStore.removeMany(currentTasks.value.map((task) => task.taskId));
    }
    return;
  }

  const confirmed = await dialog.confirm({
    title: t("download.clearConfirmTitle"),
    content: t("download.clearConfirmContent"),
    type: "warning",
  });
  if (confirmed) downloadStore.clearFinished();
};

const listRef = ref<InstanceType<typeof DownloadList> | null>(null);

const emptyText = computed(() => {
  if (tab.value === "done") return t("download.emptyDone");
  if (tab.value === "queued") return t("download.emptyQueued");
  return t("download.empty");
});

onMounted(() => void downloadStore.init());
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 顶栏 -->
    <div class="shrink-0 px-5 pb-2">
      <div class="flex items-baseline gap-4 mt-2 mb-4 min-w-0">
        <h1 class="text-3xl font-bold text-on-surface shrink-0 text-balance">
          {{ t("download.title") }}
        </h1>
        <span class="flex items-center gap-1.5 text-sm text-on-surface-variant/50 shrink-0">
          <IconLucideMusic class="size-3.5" />
          {{ t("common.totalSongs", { count: currentTasks.length }) }}
        </span>
      </div>
      <div class="flex items-center justify-between gap-4">
        <STabs
          :model-value="tab"
          :tabs="tabs"
          type="bar"
          size="large"
          @update:model-value="(key) => (tab = key as DownloadTab)"
        />
        <div class="flex items-center gap-3 shrink-0">
          <SButton
            v-if="tab === 'done'"
            type="primary"
            variant="secondary"
            round
            :disabled="currentTasks.length === 0"
            @click="listRef?.playAll()"
          >
            <template #icon><IconLucidePlay /></template>
            {{ t("common.playAll") }}
          </SButton>
          <SButton
            variant="secondary"
            round
            :disabled="headerAction.disabled"
            @click="requestHeaderAction"
          >
            <template #icon><component :is="headerAction.icon" /></template>
            {{ headerAction.label }}
          </SButton>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="flex-1 min-h-0">
      <DownloadList v-if="currentTasks.length > 0" ref="listRef" :tasks="currentTasks" />
      <div v-else class="h-full flex items-center justify-center">
        <div class="text-center text-on-surface-variant/50">
          <IconLucideDownload class="size-12 mx-auto mb-3 opacity-30" />
          <div class="text-sm">{{ emptyText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
