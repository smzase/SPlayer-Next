import type { Track } from "@shared/types/player";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audioMatch: vi.fn(),
  songsByIds: vi.fn(),
  songToTrack: vi.fn(),
}));

vi.mock("@/apis/netease", () => ({
  netease: { audio_match: mocks.audioMatch },
}));

vi.mock("@/apis/song/netease", () => ({
  songsByIds: mocks.songsByIds,
}));

vi.mock("@/utils/format/netease", () => ({
  songToTrack: mocks.songToTrack,
}));

import { matchAudioFingerprint } from "./netease";

const track = (id: string): Track => ({
  id,
  source: "netease",
  title: `歌曲 ${id}`,
  artists: [],
  duration: 180_000,
});

describe("网易云听歌识曲结果转换", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.songsByIds.mockResolvedValue([]);
    mocks.songToTrack.mockImplementation((song: { id: number }) => track(String(song.id)));
  });

  it("保留候选项的毫秒匹配位置并按歌曲去重", async () => {
    mocks.audioMatch.mockResolvedValue({
      data: {
        result: [
          { startTime: 65_432, song: { id: 1 } },
          { startTime: 70_000, song: { id: 1 } },
          { startTime: 12_000, song: { id: 2 } },
        ],
      },
    });
    mocks.songsByIds.mockResolvedValue([track("1")]);

    const results = await matchAudioFingerprint("fingerprint", 4, 1, "session");

    expect(mocks.songsByIds).toHaveBeenCalledWith(["1", "2"]);
    expect(results).toEqual([
      { track: track("1"), startTime: 65_432 },
      { track: track("2"), startTime: 12_000 },
    ]);
  });

  it("缺少或无效的匹配位置时降级为 null", async () => {
    mocks.audioMatch.mockResolvedValue({
      data: {
        result: [
          { song: { id: 1 } },
          { startTime: Number.NaN, song: { id: 2 } },
          { startTime: -100, song: { id: 3 } },
        ],
      },
    });

    const results = await matchAudioFingerprint("fingerprint", 4, 1, "session");

    expect(results.map((result) => result.startTime)).toEqual([null, null, 0]);
  });
});
