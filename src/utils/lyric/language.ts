import type { LyricLanguage, LyricLine } from "@shared/types/lyrics";

/** 日语假名：平假名 + 片假名 + 半角假名 + 促音/长音符号 */
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}\u30FC\uFF66-\uFF9F]/u;

/** 韩文：谚文音节 + 谚文字母 + 谚文兼容字母 */
const HANGUL_RE = /[\p{Script=Hangul}\u3130-\u318F]/u;

/** 中日韩统一表意文字（含扩展 A 区） */
const HAN_RE = /\p{Script=Han}/u;

/** 拉丁字母；数字与标点不能作为英文判断依据 */
const LATIN_RE = /\p{Script=Latin}/u;

/**
 * 为歌词行补充语言信息
 *
 * Han 脚本无法独立区分中日；同一首歌词出现假名时，将纯汉字行视为日语，
 * 否则视为中文。拉丁文字使用 BCP 47 的 und-Latn，避免误标为英语。
 *
 * @param lines - 已解析的整首歌词
 */
export const applyLyricLanguages = (lines: LyricLine[]): void => {
  const contents = lines.map((line) => line.words.map((word) => word.word).join(""));
  const hanLanguage: LyricLanguage = contents.some((content) => KANA_RE.test(content))
    ? "ja"
    : contents.some((content) => HANGUL_RE.test(content))
      ? "ko"
      : "zh-CN";

  for (let i = 0; i < lines.length; i++) {
    const content = contents[i];
    if (KANA_RE.test(content)) lines[i].language = "ja";
    else if (HANGUL_RE.test(content)) lines[i].language = "ko";
    else if (HAN_RE.test(content)) lines[i].language = hanLanguage;
    else if (LATIN_RE.test(content)) lines[i].language = "und-Latn";
    else delete lines[i].language;
  }
};
