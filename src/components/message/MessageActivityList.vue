<script setup lang="ts">
import type { ActivityMessage } from "@/types/message";
import { formatMessageTime } from "@/utils/format/message-time";

defineProps<{
  items: ActivityMessage[];
  loading: boolean;
  loadingMore: boolean;
  error: string;
  more: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  loadMore: [];
}>();

const { t, locale } = useI18n();
</script>

<template>
  <div v-if="loading && items.length === 0" class="flex h-full items-center justify-center">
    <div class="text-center text-on-surface-variant/60">
      <SLoading class="mx-auto mb-3 block text-3xl text-primary/70" />
      <div class="text-sm">{{ t("messages.loading") }}</div>
    </div>
  </div>

  <div v-else-if="error && items.length === 0" class="flex h-full items-center justify-center">
    <div class="flex flex-col items-center gap-3 text-center">
      <IconLucideCircleAlert class="size-10 text-on-surface-variant/35" />
      <p class="max-w-sm text-sm text-on-surface-variant">{{ error }}</p>
      <SButton variant="secondary" size="small" @click="emit('retry')">
        {{ t("common.retry") }}
      </SButton>
    </div>
  </div>

  <div v-else-if="items.length === 0" class="flex h-full items-center justify-center">
    <div class="text-center text-on-surface-variant/55">
      <IconLucideInbox class="mx-auto mb-3 size-12 opacity-40" />
      <div class="text-sm">{{ t("messages.empty") }}</div>
    </div>
  </div>

  <div v-else class="divide-y divide-outline-variant/25">
    <article
      v-for="item in items"
      :key="item.id"
      class="flex gap-3 px-2 py-3.5 transition-colors duration-200 hover:bg-on-surface/4"
    >
      <MessageAvatar :user="item.user" />
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-3">
          <p class="min-w-0 text-sm leading-5">
            <span class="font-medium text-primary">
              {{ item.user?.nickname || t("messages.systemUser") }}
            </span>
            <span class="ml-1 text-on-surface-variant">
              {{ t(`messages.action.${item.kind}`) }}
            </span>
          </p>
          <time class="shrink-0 text-xs tabular-nums text-on-surface-variant/55">
            {{ formatMessageTime(item.time, locale) }}
          </time>
        </div>
        <p
          v-if="item.text"
          :class="[
            'mt-1 min-w-0 text-sm leading-6',
            item.kind === 'commentReply' || item.kind === 'likedComment'
              ? 'truncate'
              : 'whitespace-pre-wrap break-words',
          ]"
        >
          {{ item.text }}
        </p>
        <p
          v-if="item.detail"
          class="mt-2 truncate rounded-lg bg-on-surface/5 px-3 py-2 text-xs leading-5 text-on-surface-variant"
        >
          {{ item.detail }}
        </p>
        <div
          v-if="item.resource"
          class="mt-2 flex items-center gap-2.5 rounded-lg border border-solid border-outline-variant/25 bg-on-surface/4 p-2.5"
        >
          <img
            v-if="item.resource.imageUrl"
            :src="item.resource.imageUrl"
            alt=""
            class="size-10 shrink-0 rounded-md object-cover"
            decoding="async"
            referrerpolicy="no-referrer"
          />
          <IconLucideMusic2 v-else class="mx-2 size-5 shrink-0 text-primary/70" />
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{{ item.resource.title }}</div>
            <div
              v-if="item.resource.subtitle"
              class="mt-0.5 truncate text-xs text-on-surface-variant"
            >
              {{ item.resource.subtitle }}
            </div>
          </div>
        </div>
      </div>
    </article>

    <div class="flex justify-center py-3">
      <SButton
        v-if="more"
        variant="text"
        size="small"
        :loading="loadingMore"
        @click="emit('loadMore')"
      >
        {{ t("messages.loadMore") }}
      </SButton>
      <span v-else class="text-xs text-on-surface-variant/45">{{ t("common.noMore") }}</span>
    </div>
  </div>
</template>
