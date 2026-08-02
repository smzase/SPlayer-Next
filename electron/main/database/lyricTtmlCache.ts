/**
 * TTML 歌词缓存（来自 AMLL TTML DB）
 *
 * 表：lyric_ttml_cache(platform, id, content, fetched_at) PK (platform, id)
 *
 * - id：NCM 用 netease 数字 id；QM 用 mid
 * - content：TTML 文本，NULL 表示负缓存（DB 没有这首）
 * - 正负缓存均按数据库缓存刷新周期重新获取
 */

import { isConfiguredCacheExpired } from "@main/utils/cacheRefresh";
import { getDb } from "./index";

export type Platform = "netease" | "qqmusic";

/**
 * 命中时返回 string（正缓存）或 null（负缓存）
 * 未命中或缓存已过期返回 "miss"
 */
export const getCachedTTML = (platform: Platform, id: string): string | null | "miss" => {
  const row = getDb()
    .prepare("SELECT content, fetched_at FROM lyric_ttml_cache WHERE platform = ? AND id = ?")
    .get(platform, id) as { content: string | null; fetched_at: number } | undefined;
  if (!row) return "miss";
  if (isConfiguredCacheExpired(row.fetched_at, "database")) {
    getDb().prepare("DELETE FROM lyric_ttml_cache WHERE platform = ? AND id = ?").run(platform, id);
    return "miss";
  }
  return row.content;
};

/** upsert TTML；content 为 null 表示负缓存 */
export const setCachedTTML = (platform: Platform, id: string, content: string | null): void => {
  getDb()
    .prepare(
      `INSERT INTO lyric_ttml_cache (platform, id, content, fetched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(platform, id) DO UPDATE SET
         content = excluded.content,
         fetched_at = excluded.fetched_at`,
    )
    .run(platform, id, content, Date.now());
};

/** 清空全部 TTML 缓存 */
export const clearLyricTtmlCache = (): void => {
  getDb().prepare("DELETE FROM lyric_ttml_cache").run();
};
