import { describe, expect, it, vi } from "vitest";
import zhCN from "@/i18n/locales/zh-CN.json";
import enUS from "@/i18n/locales/en-US.json";
import type { SettingItem } from "@/types/settings-schema";

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ appearanceStyle: "solid", source: "default" }),
}));

vi.mock("@/utils/color", () => ({
  DEFAULT_PRIMARY: "#000000",
  SOLID_PALETTE_LIGHT: {},
  SOLID_PALETTE_DARK: {},
  generatePalette: () => ({}),
  applyThemeToDOM: () => undefined,
}));

const getPath = (source: unknown, path: string): unknown => {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || !(segment in current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const collectItemKeys = (item: SettingItem, output: string[]): void => {
  if (!item.fullWidth) {
    output.push(`settings.${item.key}.label`);
    if (!item.hideDescription) output.push(`settings.${item.key}.description`);
  }
  for (const option of item.options ?? []) {
    if (option.labelKey) output.push(option.labelKey);
  }
  for (const key of [
    item.placeholderKey,
    item.descriptionKey,
    item.confirm?.titleKey,
    item.confirm?.contentKey,
    item.confirm?.confirmTextKey,
    item.confirm?.cancelTextKey,
    ...(item.keywords ?? []),
  ]) {
    if (key) output.push(key);
  }
  for (const child of item.children ?? []) collectItemKeys(child, output);
};

describe("设置翻译完整性", () => {
  it("schema 中使用的文案在中英文语言包中都存在", async () => {
    const globals = globalThis as Record<string, unknown>;
    for (const key of [
      "__APP_VERSION__",
      "__APP_REPO_NAME__",
      "__APP_AUTHOR__",
      "__COMMIT_HASH__",
      "__COMMIT_DATE__",
    ])
      globals[key] = "";
    globals["__APP_AUTHOR_URL__"] = "https://github.com/SPlayer-Dev";
    globals["__APP_REPO_URL__"] = "https://github.com/SPlayer-Dev/SPlayer-Next";
    globals["__APP_HOMEPAGE__"] = "https://github.com/SPlayer-Dev/SPlayer-Next";
    Object.defineProperty(window, "api", {
      configurable: true,
      value: {
        system: {
          platform: "win32",
          installType: "portable",
          osInfo: {},
        },
      },
    });
    const { settingsSchema } = await import("./schema");
    const keys = ["settings.title", "settings.subtitle"];
    for (const category of settingsSchema) {
      keys.push(`settings.group.${category.id}`);
      for (const section of category.sections ?? []) {
        keys.push(`settings.section.${section.id}`);
        for (const item of section.items) collectItemKeys(item, keys);
      }
    }

    const missingZh: string[] = [];
    const missingEn: string[] = [];
    for (const key of new Set(keys)) {
      if (typeof getPath(zhCN, key) !== "string") missingZh.push(key);
      if (typeof getPath(enUS, key) !== "string") missingEn.push(key);
    }
    expect(missingZh, "缺少中文文案").toEqual([]);
    expect(missingEn, "缺少英文文案").toEqual([]);
  });
});
