import { mount } from "@vue/test-utils";
import type { LyricLine } from "@shared/types/lyrics";
import { describe, expect, it } from "vitest";
import TaskbarLyricLine from "./TaskbarLyricLine.vue";

describe("TaskbarLyricLine", () => {
  it("保留逐字歌词中的独立空格", () => {
    const line: LyricLine = {
      words: [
        { word: "Run", startTime: 730, endTime: 1_090 },
        { word: " ", startTime: 1_090, endTime: 1_090 },
        { word: "of", startTime: 1_090, endTime: 1_520 },
        { word: " ", startTime: 1_520, endTime: 1_520 },
        { word: "the", startTime: 1_520, endTime: 1_650 },
      ],
      translatedLyric: "",
      romanLyric: "",
      startTime: 730,
      endTime: 1_650,
      isBG: false,
      isDuet: false,
    };
    const wrapper = mount(TaskbarLyricLine, {
      props: { line, wordByWord: true },
      attachTo: document.body,
    });

    const renderedWords = wrapper.findAll(".tb-word-unplayed");
    expect(renderedWords.map((word) => word.element.textContent)).toEqual([
      "Run",
      " ",
      "of",
      " ",
      "the",
    ]);
    expect(getComputedStyle(wrapper.findAll(".tb-word")[1].element).whiteSpace).toBe("pre");

    wrapper.unmount();
  });
});
