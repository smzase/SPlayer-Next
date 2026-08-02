/** 一天的毫秒数 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 判断缓存时间是否已超过刷新周期
 * @param cachedAt - 缓存写入时间
 * @param intervalDays - 刷新周期（天）
 * @param now - 当前时间
 * @returns 是否过期
 */
export const isCacheExpired = (cachedAt: number, intervalDays: number, now = Date.now()): boolean =>
  now - cachedAt >= Math.max(1, intervalDays) * DAY_MS;
