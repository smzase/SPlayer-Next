import type { Track } from "@shared/types/player";
import { describe, expect, it } from "vitest";
import { getNextTrackCandidate } from "./candidate";

const track = (id: string): Track => ({
  id,
  source: "local",
  title: id,
  artists: [],
  duration: 1_000,
});

describe("getNextTrackCandidate", () => {
  const queue = [track("a"), track("b")];

  it("列表循环在队尾预载队首", () => {
    const result = getNextTrackCandidate({
      playIndex: 1,
      queue,
      fmMode: false,
      fuckDjMode: false,
      shuffleMode: "off",
      sequentialMode: false,
    });

    expect(result?.track.id).toBe("a");
  });

  it("任务栏顺序播放在队尾不预载", () => {
    const result = getNextTrackCandidate({
      playIndex: 1,
      queue,
      fmMode: false,
      fuckDjMode: false,
      shuffleMode: "off",
      sequentialMode: true,
    });

    expect(result).toBeNull();
  });
});
