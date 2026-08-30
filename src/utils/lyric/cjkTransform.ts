/**
 * 歌词简繁中文转换（基于 OpenCC）
 */

import type { LyricLine } from "@shared/types/lyrics";
import type { CjkTransformMode } from "@shared/types/opencc";

/**
 * 对歌词行数组应用 OpenCC 简繁转换
 * @param lines - 原始歌词行数组
 * @param mode - 转换模式
 * @returns 转换后的歌词行数组（深拷贝结构）
 */
export const applyLyricCjkTransform = async (
  lines: LyricLine[],
  mode: CjkTransformMode,
): Promise<LyricLine[]> => {
  if (!lines || lines.length === 0 || !mode || mode === "none") {
    return lines;
  }

  if (typeof window === "undefined" || !window.api?.opencc?.convertBatch) {
    return lines;
  }

  // 收集所有需要转换的文本片段并记录位置
  const textsToConvert: string[] = [];
  const textPositions: Array<
    | { type: "translated"; lineIndex: number }
    | { type: "word"; lineIndex: number; wordIndex: number }
    | { type: "ruby"; lineIndex: number; wordIndex: number; rubyIndex: number }
  > = [];

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];

    // 翻译文本
    if (line.translatedLyric) {
      textsToConvert.push(line.translatedLyric);
      textPositions.push({ type: "translated", lineIndex: lIdx });
    }

    // 逐字文本
    if (line.words) {
      for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
        const word = line.words[wIdx];
        if (word.word) {
          textsToConvert.push(word.word);
          textPositions.push({ type: "word", lineIndex: lIdx, wordIndex: wIdx });
        }

        // 注音文本
        if (word.ruby) {
          for (let rIdx = 0; rIdx < word.ruby.length; rIdx++) {
            const ruby = word.ruby[rIdx];
            if (ruby.word) {
              textsToConvert.push(ruby.word);
              textPositions.push({
                type: "ruby",
                lineIndex: lIdx,
                wordIndex: wIdx,
                rubyIndex: rIdx,
              });
            }
          }
        }
      }
    }
  }

  if (textsToConvert.length === 0) {
    return lines;
  }

  try {
    const convertedTexts = await window.api.opencc.convertBatch(textsToConvert, mode);

    // 深拷贝原始结构，避免直接突变可能导致的缓存污染
    const resultLines: LyricLine[] = lines.map((line) => ({
      ...line,
      words: line.words.map((w) => ({
        ...w,
        ruby: w.ruby ? w.ruby.map((r) => ({ ...r })) : undefined,
      })),
    }));

    for (let i = 0; i < convertedTexts.length; i++) {
      const pos = textPositions[i];
      const converted = convertedTexts[i];

      if (pos.type === "translated") {
        resultLines[pos.lineIndex].translatedLyric = converted;
      } else if (pos.type === "word") {
        resultLines[pos.lineIndex].words[pos.wordIndex].word = converted;
      } else if (pos.type === "ruby") {
        const rubyArr = resultLines[pos.lineIndex].words[pos.wordIndex].ruby;
        if (rubyArr && rubyArr[pos.rubyIndex]) {
          rubyArr[pos.rubyIndex].word = converted;
        }
      }
    }

    return resultLines;
  } catch (error) {
    console.error("[OpenCC] 歌词转换失败:", error);
    return lines;
  }
};
