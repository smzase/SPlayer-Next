import { describe, expect, it } from "vitest";
import { getCollectionShareUrl } from "./shareUrl";

describe("集合分享链接", () => {
  it("生成网易云歌单和专辑链接", () => {
    expect(getCollectionShareUrl({ id: "1", source: "netease", type: "playlist" })).toBe(
      "https://music.163.com/#/playlist?id=1",
    );
    expect(getCollectionShareUrl({ id: "2", source: "netease", type: "album" })).toBe(
      "https://music.163.com/#/album?id=2",
    );
  });

  it("生成 QQ 音乐歌单和专辑链接", () => {
    expect(getCollectionShareUrl({ id: "3", source: "qqmusic", type: "playlist" })).toBe(
      "https://y.qq.com/n/ryqq_v2/playlist/3",
    );
    expect(getCollectionShareUrl({ id: "4", source: "qqmusic", type: "album" })).toBe(
      "https://y.qq.com/n/ryqq_v2/albumDetail/4",
    );
  });

  it("本地与流媒体集合不提供分享链接", () => {
    expect(getCollectionShareUrl({ id: "5", source: "local", type: "playlist" })).toBeNull();
    expect(getCollectionShareUrl({ id: "6", source: "streaming", type: "album" })).toBeNull();
  });
});
