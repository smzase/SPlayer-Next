<script setup lang="ts">
import type { FollowResource, FollowUploadedImage, FollowUploadImage } from "@/types/follow";
import { publishFollowPost, uploadFollowImage } from "@/apis/follow/netease";
import { toast } from "@/composables/useToast";

defineProps<{
  open: boolean;
  userId: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  published: [];
}>();

const { t } = useI18n();
const text = ref("");
const resource = shallowRef<FollowResource | null>(null);
const images = shallowRef<FollowUploadImage[]>([]);
const resourceSelectorOpen = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const publishing = ref(false);
const uploadProgress = ref(0);
const exitConfirmOpen = ref(false);
const editorVersion = ref(0);

const dirty = computed(
  () => !!text.value.trim() || resource.value !== null || images.value.length > 0,
);
const canPublish = computed(() => resource.value !== null && !publishing.value);

const releaseImages = (): void => {
  for (const image of images.value) URL.revokeObjectURL(image.previewUrl);
  images.value = [];
};

const reset = (): void => {
  text.value = "";
  resource.value = null;
  uploadProgress.value = 0;
  releaseImages();
};

const close = (): void => {
  if (publishing.value || exitConfirmOpen.value) return;
  if (dirty.value) {
    exitConfirmOpen.value = true;
    return;
  }
  reset();
  emit("update:open", false);
};

const cancelExit = (): void => {
  exitConfirmOpen.value = false;
  editorVersion.value += 1;
};

const keepAndClose = (): void => {
  exitConfirmOpen.value = false;
  emit("update:open", false);
};

const discardAndClose = (): void => {
  exitConfirmOpen.value = false;
  reset();
  emit("update:open", false);
};

const handleOpenChange = (open: boolean): void => {
  if (!open) close();
};

const selectImages = (event: Event): void => {
  const input = event.currentTarget as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  if (!files.length) return;
  const available = Math.max(0, 9 - images.value.length);
  const accepted = files
    .filter((file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024)
    .slice(0, available);
  if (accepted.length !== files.length) toast.warning(t("follow.publish.imageLimit"));
  images.value = [
    ...images.value,
    ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
  ];
};

const removeImage = (index: number): void => {
  const image = images.value[index];
  if (!image) return;
  URL.revokeObjectURL(image.previewUrl);
  images.value = images.value.filter((_, current) => current !== index);
};

const publish = async (): Promise<void> => {
  if (!resource.value || publishing.value) return;
  publishing.value = true;
  uploadProgress.value = 0;
  try {
    const uploaded: FollowUploadedImage[] = [];
    for (let index = 0; index < images.value.length; index += 1) {
      uploaded.push(await uploadFollowImage(images.value[index].file));
      uploadProgress.value = index + 1;
    }
    await publishFollowPost(text.value.trim(), resource.value, uploaded);
    toast.success(t("follow.publish.done"));
    reset();
    emit("update:open", false);
    emit("published");
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    publishing.value = false;
  }
};

onBeforeUnmount(releaseImages);
</script>

<template>
  <SDialog
    :key="editorVersion"
    :open="open"
    :title="t('follow.publish.title')"
    :closable="false"
    width="min(680px, 92vw)"
    @update:open="handleOpenChange"
  >
    <SButton
      variant="ghost"
      circle
      size="small"
      class="absolute top-3 right-3"
      :disabled="publishing"
      :title="t('common.close')"
      @click="close"
    >
      <template #icon><IconLucideX /></template>
    </SButton>

    <div class="pb-1">
      <FollowTextComposer
        v-model="text"
        :user-id="userId"
        :placeholder="t('follow.publish.placeholder')"
        :maxlength="1000"
        :rows="5"
        :disabled="publishing"
        show-emoji
      >
        <template #tools>
          <SButton
            variant="ghost"
            circle
            size="small"
            :disabled="publishing || images.length >= 9"
            :title="t('follow.composer.image')"
            @click="fileInputRef?.click()"
          >
            <template #icon><IconLucideImagePlus /></template>
          </SButton>
        </template>
      </FollowTextComposer>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        class="hidden"
        @change="selectImages"
      />

      <div v-if="images.length" class="mt-4 grid grid-cols-3 gap-2">
        <div
          v-for="(image, index) in images"
          :key="image.previewUrl"
          class="group relative aspect-square overflow-hidden rounded-xl bg-on-surface/6"
        >
          <img :src="image.previewUrl" alt="" decoding="async" class="size-full object-cover" />
          <SButton
            variant="filled"
            circle
            size="small"
            class="absolute top-1.5 right-1.5 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
            :title="t('follow.publish.removeImage')"
            @click="removeImage(index)"
          >
            <template #icon><IconLucideX /></template>
          </SButton>
        </div>
      </div>

      <div class="mt-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium text-on-surface">
            {{ t("follow.publish.resourceRequired") }}
          </span>
          <span class="text-xs text-on-surface-variant/45">
            {{ t("follow.publish.resourceHint") }}
          </span>
        </div>
        <FollowResourceCard
          v-if="resource"
          :resource="resource"
          removable
          @remove="resource = null"
        />
        <button
          v-else
          type="button"
          class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-on-surface/18 bg-transparent py-3 text-sm text-on-surface-variant/55 transition-colors duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          @click="resourceSelectorOpen = true"
        >
          <IconLucidePlus class="size-4" />
          {{ t("follow.publish.selectResource") }}
        </button>
      </div>
    </div>

    <template #footer>
      <span v-if="publishing && images.length" class="mr-auto text-xs text-on-surface-variant/50">
        {{ t("follow.publish.uploading", { current: uploadProgress, total: images.length }) }}
      </span>
      <SButton type="primary" round :disabled="!canPublish" :loading="publishing" @click="publish">
        {{ t("follow.publish.submit") }}
      </SButton>
    </template>
  </SDialog>

  <SDialog
    :open="exitConfirmOpen"
    :title="t('follow.publish.exitTitle')"
    :closable="false"
    width="420px"
    @update:open="(value) => !value && cancelExit()"
  >
    <p class="m-0 text-sm whitespace-pre-line text-on-surface-variant">
      {{ t("follow.publish.exitConfirm") }}
    </p>
    <template #footer>
      <SButton variant="secondary" @click="cancelExit">{{ t("common.cancel") }}</SButton>
      <SButton @click="keepAndClose">{{ t("follow.publish.keep") }}</SButton>
      <SButton type="warning" @click="discardAndClose">
        {{ t("follow.publish.exit") }}
      </SButton>
    </template>
  </SDialog>

  <FollowResourceSelector v-model:open="resourceSelectorOpen" @select="resource = $event" />
</template>
