<script setup lang="ts">
import type { UserSearchItem } from "@/types/search";

defineProps<{
  items: UserSearchItem[];
  hasMore: boolean;
  loadingMore: boolean;
}>();

const emit = defineEmits<{
  reachBottom: [];
}>();

const { t } = useI18n();
const router = useRouter();

const openUser = (user: UserSearchItem): void => {
  router.push({ name: "user-profile", params: { uid: user.id } });
};
</script>

<template>
  <SVirtualList
    :items="items"
    :item-height="84"
    :padding-top="8"
    :padding-bottom="80"
    :get-item-key="(item: UserSearchItem) => item.id"
    item-fixed
    height="100%"
    @reach-bottom="emit('reachBottom')"
  >
    <template #default="{ item }: { item: UserSearchItem }">
      <div class="px-5 pb-2">
        <button
          type="button"
          class="group flex h-19 w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-solid border-primary/12 bg-surface-panel px-4 text-left transition-[background-color,border-color] duration-200 hover:border-primary/30 hover:bg-on-surface/8"
          @click="openUser(item)"
        >
          <span
            class="flex size-12 shrink-0 overflow-hidden rounded-full bg-on-surface/8 ring-1 ring-on-surface/10"
          >
            <SImg v-if="item.avatar" :src="item.avatar" class="size-full" />
            <IconLucideUserRound v-else class="m-auto size-5 text-on-surface-variant/45" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold text-on-surface group-hover:text-primary">
                {{ item.name }}
              </span>
              <span
                v-if="item.mutual || item.followed"
                class="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
              >
                {{ t(item.mutual ? "userProfile.mutual" : "userProfile.following") }}
              </span>
            </span>
            <span class="mt-1 block truncate text-xs text-on-surface-variant/50">
              {{ item.signature || t("userProfile.noSignature") }}
            </span>
          </span>
          <IconLucideChevronRight
            class="size-4 shrink-0 text-on-surface-variant/30 transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </template>
    <template #footer>
      <div
        v-if="loadingMore"
        class="flex items-center justify-center gap-2 py-4 text-xs text-on-surface-variant/45"
      >
        <SLoading />
        {{ t("common.loading") }}
      </div>
    </template>
  </SVirtualList>
</template>
