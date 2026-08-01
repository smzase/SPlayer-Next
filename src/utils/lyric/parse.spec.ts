import { describe, expect, it } from "vitest";
import { bestExternalIndex, detectFormat, parseLyric } from "./parse";

describe("lyric parse", () => {
  it("根据内容识别常见歌词格式", () => {
    expect(detectFormat("[00:01.00]歌词")).toBe("lrc");
    expect(detectFormat("1\n00:00:01,000 --> 00:00:02,000\n歌词")).toBe("srt");
    expect(detectFormat('<tt xmlns="http://www.w3.org/ns/ttml"></tt>')).toBe("ttml");
    expect(detectFormat("[1000,500](1000,500,0)歌词")).toBe("yrc");
    expect(detectFormat("[1000,500]歌词(1000,500)")).toBe("qrc");
  });

  it("按照指定优先级选择外部歌词", () => {
    const lyrics = [{ format: "lrc" as const }, { format: "ttml" as const }];

    expect(bestExternalIndex(lyrics, ["ttml", "lrc"])).toBe(1);
    expect(bestExternalIndex([], ["ttml", "lrc"])).toBe(-1);
  });

  it("LRC 会忽略元数据、按时间排序并展开多时间戳", () => {
    const lines = parseLyric(
      { content: "[ar:歌手]\n[00:02.00]第二行\n[00:01.00][00:03.00]重复行" },
      "lrc",
    );

    expect(lines.map(({ startTime }) => startTime)).toEqual([1_000, 2_000, 3_000]);
    expect(lines.map(({ words }) => words.map(({ word }) => word).join(""))).toEqual([
      "重复行",
      "第二行",
      "重复行",
    ]);
  });

  it("在容差内配对翻译和音译，超过容差时不误配", () => {
    const lines = parseLyric(
      {
        content: "[00:01.00]Hello\n[00:02.00]World",
        translation: "[00:01.20]你好\n[00:02.40]世界",
        translationFormat: "lrc",
        romaji: "[00:01.10]Harō\n[00:02.10]Wārudo",
        romajiFormat: "lrc",
      },
      "lrc",
    );

    expect(lines[0].translatedLyric).toBe("你好");
    expect(lines[1].translatedLyric).toBe("");
    expect(lines[0].romanLyric).toBe("Harō");
    expect(lines[1].romanLyric).toBe("Wārudo");
  });

  it("过滤无意义的翻译占位内容", () => {
    const lines = parseLyric(
      {
        content: "[00:01.00]Hello\n[00:02.00]World",
        translation: "[00:01.00]//\n[00:02.00]作品的著作权由原作者所有",
        translationFormat: "lrc",
      },
      "lrc",
    );

    expect(lines.every(({ translatedLyric }) => translatedLyric === "")).toBe(true);
  });

  it("忽略只有时间标签的空歌词行", () => {
    const lines = parseLyric({ content: "[00:00.00]A\n[00:01.00]\n[00:02.00]B" }, "lrc");

    expect(lines).toHaveLength(2);
    expect(lines[0].endTime).toBe(2_000);
    expect(lines.every(({ words }) => words.length > 0)).toBe(true);
  });

  it("将括号包裹的 LRC 行标记为独立背景歌词", () => {
    const lines = parseLyric(
      {
        content:
          "[01:48.390]耳をすましてみるよ\n" +
          "[01:50.220](聞こえる)\n" +
          "[01:53.570]今を信じるために\n" +
          "[01:56.810](鼓動が)",
      },
      "lrc",
    );

    expect(lines.filter(({ isBG }) => isBG)).toHaveLength(2);
    expect(
      lines.filter(({ isBG }) => isBG).map(({ words }) => words.map(({ word }) => word).join("")),
    ).toEqual(["聞こえる", "鼓動が"]);
  });

  it("将 TTML x-bg 解析为独立背景歌词", () => {
    const content =
      '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">' +
      '<body><div><p begin="00:01.000" end="00:04.000">' +
      '<span begin="00:01.000" end="00:02.000">主歌词</span>' +
      '<span ttm:role="x-bg" begin="00:02.000" end="00:04.000">' +
      '<span begin="00:02.000" end="00:04.000">(背景歌词)</span>' +
      "</span></p></div></body></tt>";
    const lines = parseLyric({ content }, "ttml");

    expect(lines).toHaveLength(2);
    expect(lines[0].isBG).toBe(false);
    expect(lines[1].isBG).toBe(true);
    expect(lines[1].words.map(({ word }) => word).join("")).toBe("背景歌词");
  });

  it("使用 ESLRC 末尾时间标签结束最后一个字", () => {
    const [line] = parseLyric({ content: "[00:00.00]<00:00.00>A<00:01.00>B<00:02.00>" }, "lrc");

    expect(line.words).toEqual([
      { startTime: 0, endTime: 1_000, word: "A" },
      { startTime: 1_000, endTime: 2_000, word: "B" },
    ]);
    expect(line.endTime).toBe(2_000);
  });
});
