<script setup lang="ts">
import type { MessageUser } from "@/types/message";

const props = withDefaults(
  defineProps<{
    user?: MessageUser;
    size?: "small" | "medium" | "large";
  }>(),
  { size: "medium" },
);

const emit = defineEmits<{
  navigate: [];
}>();

const { t } = useI18n();
const router = useRouter();

const sizeClass = computed(
  () => ({ small: "size-8", medium: "size-11", large: "size-12" })[props.size],
);

/** 打开应用内用户主页 */
const openUser = (): void => {
  if (!props.user?.userId) return;
  router.push({ name: "user-profile", params: { uid: props.user.userId } });
  emit("navigate");
};
</script>

<template>
  <button
    type="button"
    :disabled="!user?.userId"
    :title="user?.userId ? t('messages.openUserHome') : undefined"
    :aria-label="user?.userId ? t('messages.openUserHome') : undefined"
    :class="[
      sizeClass,
      'shrink-0 overflow-hidden rounded-full border border-solid border-outline-variant/30 bg-on-surface/8',
      user?.userId && 'cursor-pointer transition-transform duration-200 hover:scale-105',
    ]"
    @click.stop="openUser"
  >
    <img
      v-if="user?.avatarUrl"
      :src="user.avatarUrl"
      :alt="user.nickname"
      class="size-full object-cover"
      decoding="async"
      referrerpolicy="no-referrer"
    />
    <span v-else class="flex size-full items-center justify-center text-on-surface-variant/60">
      <IconLucideUserRound class="size-1/2" />
    </span>
  </button>
</template>
