import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRecentPodcasts, fetchRecentVoices } from "./netease";

const mocks = vi.hoisted(() => ({
  recentPlay: vi.fn(),
  recentPlayRemove: vi.fn(),
}));

vi.mock("@/apis/netease", () => ({
  netease: {
    recent_play: mocks.recentPlay,
    recent_play_remove: mocks.recentPlayRemove,
  },
}));

describe("网易云多端最近播放转换", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("区分声音的节目 ID、播放 ID 和播客来源", async () => {
    mocks.recentPlay.mockResolvedValue({
      code: 200,
      data: {
        list: [
          {
            playTime: 123456,
            data: {
              pubDJProgramData: {
                id: 3081133072,
                name: "测试声音",
                mainTrackId: 2725832901,
                duration: 180000,
                radio: {
                  id: 9988,
                  name: "测试播客",
                },
              },
            },
          },
        ],
      },
    });

    const [entry] = await fetchRecentVoices();

    expect(entry).toMatchObject({
      resourceId: "3081133072",
      playedAt: 123456,
      item: {
        id: "2725832901",
        extId: "3081133072",
        playbackSource: { id: "9988", type: "radio" },
      },
    });
  });

  it("转换最近播放中的播客容器", async () => {
    mocks.recentPlay.mockResolvedValue({
      code: 200,
      data: {
        list: [
          {
            playTime: 234567,
            data: {
              radio: {
                id: 5566,
                name: "测试播客",
                picUrl: "https://example.com/cover.jpg",
                dj: { nickname: "主播" },
              },
            },
          },
        ],
      },
    });

    const [entry] = await fetchRecentPodcasts();

    expect(entry).toMatchObject({
      resourceId: "5566",
      playedAt: 234567,
      item: {
        id: "5566",
        name: "测试播客",
        creator: "主播",
      },
    });
  });
});
