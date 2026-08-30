/**
 * 时间戳解析工具
 * 支持 LRC / TTML 等多种时间戳格式，可被各歌词解析器复用
 */

/** 最大时间戳（999:59.999） */
export const MAX_TIME = 60039999;

/**
 * 匹配方括号时间戳 [mm:ss.xxx] / [mm:ss:xxx] / [mm:ss.xx] / [mm:ss.x]
 * 使用时注意 lastIndex（全局正则）
 */
export const BRACKET_TIME_RE = /\[(\d+):(\d+)[.:](\d{1,3})\]/g;

/**
 * 匹配尖括号时间戳 <mm:ss.xxx> / <mm:ss:xxx> / <mm:ss.xx> / <mm:ss.x>
 * 使用时注意 lastIndex（全局正则）
 */
export const ANGLE_TIME_RE = /<(\d+):(\d+)(?:[.:](\d{1,3}))?>([^<]*)/g;

/**
 * 将分、秒、毫秒字符串解析为毫秒数
 * 自动归一化毫秒位数：1 位 ×100，2 位 ×10，3 位不变
 * @param min 分钟字符串
 * @param sec 秒字符串
 * @param ms 毫秒字符串（1~3 位）
 * @param padEndMs 是否自动归一化毫秒位数（默认 true）
 * @returns 毫秒数，不超过 MAX_TIME
 */
export const parseTime = (
  min: string,
  sec: string,
  ms: string,
  padEndMs: boolean = true,
): number => {
  const m = parseInt(min, 10);
  const s = parseInt(sec, 10);
  let millis = parseInt(ms, 10) || 0;

  if (padEndMs) {
    if (ms.length === 1) millis *= 100;
    else if (ms.length === 2) millis *= 10;
  }

  return Math.min(m * 60_000 + s * 1000 + millis, MAX_TIME);
};

/**
 * 解析方括号时间戳字符串 "[mm:ss.xxx]" 为毫秒数
 * @param tag 完整的时间戳字符串，如 "[01:23.456]"
 * @returns 毫秒数，解析失败返回 -1
 */
export const parseBracketTag = (tag: string): number => {
  const m = /^\[(\d+):(\d+)[.:](\d{1,3})\]$/.exec(tag);
  if (!m) return -1;
  return parseTime(m[1], m[2], m[3]);
};

/**
 * 解析 TTML 时间戳为毫秒数
 * 支持格式：
 * - 纯秒数："1.234s"
 * - 分:秒："01:23.456"
 * - 时:分:秒："00:01:23.456"
 * @param value TTML 时间戳字符串
 * @returns 毫秒数
 */
export const parseTTMLTime = (value: string): number => {
  const text = value.trim();
  if (!text) return 0;
  // 纯秒数格式：1.234s
  if (text.endsWith("s") && !text.includes(":")) {
    return Math.round(Number(text.slice(0, -1)) * 1000);
  }
  // 冒号分隔格式：[hh:]mm:ss[.fff]
  const parts = text.split(":");
  const last = parts[parts.length - 1] ?? "0";
  const [secStr, fracStr] = last.split(".");
  const sec = Number(secStr || "0");
  const ms = fracStr ? Number(fracStr.padEnd(3, "0").slice(0, 3)) : 0;
  let min = 0;
  let hr = 0;
  if (parts.length === 2) {
    min = Number(parts[0] || "0");
  } else if (parts.length >= 3) {
    hr = Number(parts[0] || "0");
    min = Number(parts[1] || "0");
  }
  return ((hr * 60 + min) * 60 + sec) * 1000 + ms;
};
