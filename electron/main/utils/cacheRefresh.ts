import { store } from "@main/store";
import { isCacheExpired } from "@shared/utils/cacheRefresh";

export type CacheRefreshKind = "file" | "database";

/** 配置异常时使用的刷新周期 */
const FALLBACK_DAYS: Record<CacheRefreshKind, number> = {
  file: 30,
  database: 7,
};

/**
 * 按当前设置判断缓存是否过期
 * @param cachedAt - 缓存写入时间
 * @param kind - 缓存介质
 * @param now - 当前时间
 * @returns 是否过期
 */
export const isConfiguredCacheExpired = (
  cachedAt: number,
  kind: CacheRefreshKind,
  now = Date.now(),
): boolean => {
  const configured =
    kind === "file"
      ? store.get("cache.fileRefreshIntervalDays")
      : store.get("cache.databaseRefreshIntervalDays");
  const days = Number.isFinite(configured) ? configured : FALLBACK_DAYS[kind];
  return isCacheExpired(cachedAt, days, now);
};
