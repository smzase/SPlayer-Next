import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LyricLine } from "../types/lyrics";
import { hasRealWordTiming } from "./lyricSync";
import {
  nextTaskbarPlayMode,
  resolveTaskbarPlayMode,
  resolveTaskbarPlayModeState,
} from "./taskbarLyric";

const makeLine = (times: Array<[number, number]>): LyricLine => ({
  words: times.map(([startTime, endTime], index) => ({
    word: String(index),
    startTime,
    endTime,
  })),
  translatedLyric: "",
  romanLyric: "",
  startTime: times[0]?.[0] ?? 0,
  endTime: times.at(-1)?.[1] ?? 0,
  isBG: false,
  isDuet: false,
});

describe("taskbar play mode", () => {
  it("将底层状态归一为四态模式，随机状态优先", () => {
    assert.equal(resolveTaskbarPlayMode("list", "off"), "repeat-list");
    assert.equal(resolveTaskbarPlayMode("one", "off"), "repeat-one");
    assert.equal(resolveTaskbarPlayMode("off", "off"), "sequential");
    assert.equal(resolveTaskbarPlayMode("one", "on"), "shuffle");
  });

  it("映射为互斥的底层循环与随机状态", () => {
    assert.deepEqual(resolveTaskbarPlayModeState("repeat-list"), {
      repeatMode: "list",
      shuffleMode: "off",
    });
    assert.deepEqual(resolveTaskbarPlayModeState("repeat-one"), {
      repeatMode: "one",
      shuffleMode: "off",
    });
    assert.deepEqual(resolveTaskbarPlayModeState("shuffle"), {
      repeatMode: "list",
      shuffleMode: "on",
    });
    assert.deepEqual(resolveTaskbarPlayModeState("sequential"), {
      repeatMode: "off",
      shuffleMode: "off",
    });
  });

  it("按列表循环、单曲循环、随机、顺序循环切换", () => {
    assert.equal(nextTaskbarPlayMode("repeat-list"), "repeat-one");
    assert.equal(nextTaskbarPlayMode("repeat-one"), "shuffle");
    assert.equal(nextTaskbarPlayMode("shuffle"), "sequential");
    assert.equal(nextTaskbarPlayMode("sequential"), "repeat-list");
  });
});

describe("hasRealWordTiming", () => {
  it("区分整行时间与真实逐字时间", () => {
    assert.equal(hasRealWordTiming(makeLine([[0, 1000]])), false);
    assert.equal(
      hasRealWordTiming(
        makeLine([
          [0, 500],
          [500, 1000],
        ]),
      ),
      true,
    );
    assert.equal(
      hasRealWordTiming(
        makeLine([
          [0, 0],
          [0, 0],
        ]),
      ),
      false,
    );
  });
});
