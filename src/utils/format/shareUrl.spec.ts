import { describe, expect, it } from "vitest";
import { getCollectionShareUrl, getShareUrl } from "./shareUrl";

describe("曲目分享链接", () => {
  it("声音节目使用节目 ID 生成链接", () => {
    expect(
      getShareUrl({
        id: "2725832901",
        extId: "3081133072",
        source: "netease",
        title: "测试声音",
        artists: [],
        duration: 0,
      }),
    ).toBe("https://music.163.com/#/dj?id=3081133072");
  });

  it("普通网易云歌曲仍使用歌曲 ID 生成链接", () => {
    expect(
      getShareUrl({
        id: "2725832901",
        source: "netease",
        title: "测试歌曲",
        artists: [],
        duration: 0,
      }),
    ).toBe("https://music.163.com/#/song?id=2725832901");
  });
});

describe("集合分享链接", () => {
  it("生成网易云歌单和专辑链接", () => {
    expect(getCollectionShareUrl({ id: "1", source: "netease", type: "playlist" })).toBe(
      "https://music.163.com/#/playlist?id=1",
    );
    expect(getCollectionShareUrl({ id: "2", source: "netease", type: "album" })).toBe(
      "https://music.163.com/#/album?id=2",
    );
    expect(getCollectionShareUrl({ id: "7", source: "netease", type: "radio" })).toBe(
      "https://music.163.com/#/djradio?id=7",
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
