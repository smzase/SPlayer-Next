<script setup lang="ts">
import type { UserPageProfile, UserProfileUpdate } from "@/types/user-profile";
import type { SSelectOption } from "@/components/ui/SSelect.vue";
import { updateCurrentUserProfile } from "@/apis/user-profile/netease";
import { toast } from "@/composables/useToast";
import { CHINA_REGIONS } from "@/data/china-regions";

const props = defineProps<{
  open: boolean;
  profile: UserPageProfile;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const { t } = useI18n();
const form = reactive({
  nickname: "",
  signature: "",
  gender: 0,
  birthday: "",
  province: 0,
  city: 0,
});
const saving = ref(false);

const provinceOptions = computed<SSelectOption[]>(() => {
  const options = CHINA_REGIONS.map(({ code, name }) => ({ value: code, label: name }));
  if (form.province && !options.some(({ value }) => value === form.province)) {
    options.push({
      value: form.province,
      label: t("userProfile.edit.currentRegion", { code: form.province }),
    });
  }
  return options;
});

const cityOptions = computed<SSelectOption[]>(() => {
  const cities = CHINA_REGIONS.find(({ code }) => code === form.province)?.children ?? [];
  const options = cities.map(({ code, name }) => ({ value: code, label: name }));
  if (form.city && !options.some(({ value }) => value === form.city)) {
    options.push({
      value: form.city,
      label: t("userProfile.edit.currentRegion", { code: form.city }),
    });
  }
  return options;
});

const toDateInput = (timestamp?: number): string => {
  if (!timestamp || timestamp < 0) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
};

watch(
  () => [props.open, props.profile] as const,
  ([open, profile]) => {
    if (!open) return;
    form.nickname = profile.nickname;
    form.signature = profile.signature ?? "";
    form.gender = profile.gender;
    form.birthday = toDateInput(profile.birthday);
    form.province = profile.province ?? 0;
    form.city = profile.city ?? 0;
  },
  { immediate: true },
);

const setOpen = (open: boolean): void => emit("update:open", open);

/** 切换省份并将城市重置为该省首个可用选项 */
const selectProvince = (value: string | number | boolean): void => {
  form.province = Number(value);
  form.city = CHINA_REGIONS.find(({ code }) => code === form.province)?.children[0]?.code ?? 0;
};

/** 更新选中的城市 */
const selectCity = (value: string | number | boolean): void => {
  form.city = Number(value);
};

/** 提交个人资料并刷新主页 */
const save = async (): Promise<void> => {
  const nickname = form.nickname.trim();
  if (!nickname || saving.value) return;
  const birthday = form.birthday
    ? new Date(form.birthday + "T00:00:00").getTime()
    : (props.profile.birthday ?? 0);
  const payload: UserProfileUpdate = {
    nickname,
    signature: form.signature.trim(),
    gender: form.gender,
    birthday,
    province: form.province || props.profile.province || 0,
    city: form.city || props.profile.city || 0,
  };
  saving.value = true;
  try {
    await updateCurrentUserProfile(payload);
    toast.success(t("userProfile.edit.done"));
    emit("saved");
    setOpen(false);
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause));
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <SDialog
    :open="open"
    :title="t('userProfile.edit.title')"
    width="min(520px, calc(100vw - 40px))"
    @update:open="setOpen"
  >
    <div class="space-y-4 pb-1">
      <SFormItem :label="t('userProfile.edit.nickname')">
        <SInput v-model="form.nickname" :maxlength="30" />
      </SFormItem>
      <SFormItem :label="t('userProfile.edit.signature')">
        <SInput v-model="form.signature" type="textarea" :rows="5" :maxlength="300" />
      </SFormItem>
      <SFormItem :label="t('userProfile.edit.gender')">
        <SRadioGroup v-model:value="form.gender">
          <SRadio :value="0">{{ t("userProfile.gender.secret") }}</SRadio>
          <SRadio :value="1">{{ t("userProfile.gender.male") }}</SRadio>
          <SRadio :value="2">{{ t("userProfile.gender.female") }}</SRadio>
        </SRadioGroup>
      </SFormItem>
      <SFormItem :label="t('userProfile.edit.birthday')">
        <input
          v-model="form.birthday"
          type="date"
          class="h-9 w-full rounded-lg border border-solid border-on-surface/15 bg-on-surface/3 px-3 text-sm text-on-surface outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:border-primary focus:bg-on-surface/8 focus:ring-2 focus:ring-primary/20"
        />
      </SFormItem>
      <SFormItem :label="t('userProfile.edit.region')">
        <div class="grid grid-cols-2 gap-3">
          <SSelect
            :model-value="form.province || undefined"
            :options="provinceOptions"
            :placeholder="t('userProfile.edit.chooseProvince')"
            @update:model-value="selectProvince"
          />
          <SSelect
            :model-value="form.city || undefined"
            :options="cityOptions"
            :disabled="cityOptions.length === 0"
            :placeholder="t('userProfile.edit.chooseCity')"
            @update:model-value="selectCity"
          />
        </div>
      </SFormItem>
    </div>
    <template #footer>
      <SButton variant="secondary" :disabled="saving" @click="setOpen(false)">
        {{ t("common.cancel") }}
      </SButton>
      <SButton type="primary" :loading="saving" :disabled="!form.nickname.trim()" @click="save">
        {{ t("common.save") }}
      </SButton>
    </template>
  </SDialog>
</template>
