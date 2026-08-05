import { describe, expect, it } from "vitest";
import type { Track } from "@shared/types/player";
import { toNeteaseScrobbleTrack } from "@shared/utils/neteaseScrobble";

const track: Track = {
  id: "123",
  source: "netease",
  title: "测试歌曲",
  artists: [{ name: "歌手" }],
  album: { id: "999", name: "不应作为来源的专辑" },
  duration: 180000,
};

describe("网易云听歌打卡元数据", () => {
  it("没有播放上下文时以歌曲自身作为来源", () => {
    expect(toNeteaseScrobbleTrack(track, 180000)).toMatchObject({
      id: "123",
      sourceId: "123",
      sourceType: "song",
    });
  });

  it("播放歌单时使用真实歌单来源而不是专辑 ID", () => {
    expect(
      toNeteaseScrobbleTrack({ ...track, playbackSource: { id: "456", type: "list" } }, 180000),
    ).toMatchObject({
      id: "123",
      sourceId: "456",
      sourceType: "list",
    });
  });

  it("无效来源 ID 回退到歌曲来源", () => {
    expect(
      toNeteaseScrobbleTrack(
        { ...track, playbackSource: { id: "playlist:test", type: "list" } },
        180000,
      ),
    ).toMatchObject({
      sourceId: "123",
      sourceType: "song",
    });
  });
});
