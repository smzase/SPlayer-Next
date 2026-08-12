import { describe, expect, it } from "vitest";
import { buildPld, buildPlv, createPlaybackLogContext, toNcblSourceType } from "./playLog";

const context = createPlaybackLogContext({});
const song = {
  id: 123,
  type: "song" as const,
  name: "测试歌曲",
  artist: "测试歌手",
  bitrate: 320,
  level: "exhigh",
  fee: 1 as const,
  time: 180,
};

describe("网易云 NCBL 播放日志", () => {
  it.each([
    ["song", "song", "track"],
    ["song", "list", "list"],
    ["song", "album", "album"],
    ["song", "artist", "artist"],
    ["dj", "radio", "djradio"],
  ] as const)("将 %s 资源的 %s 来源映射为 %s", (resourceType, sourceType, expected) => {
    expect(toNcblSourceType(resourceType, sourceType)).toBe(expected);
  });

  it("歌单与专辑保留来源 ID 和类型", () => {
    expect(buildPlv(context, song, { id: "456", type: "list", name: "list" })).toMatchObject({
      id: "123",
      type: "song",
      sourceId: "456",
      sourcetype: "list",
    });
    expect(buildPld(context, song, { id: "999", type: "album", name: "album" }, 60)).toMatchObject({
      id: "123",
      type: "song",
      sourceId: "999",
      sourcetype: "album",
    });
  });

  it("声音以节目 ID 和 dj 类型写入日志", () => {
    const voice = {
      ...song,
      id: 3081133072,
      type: "dj" as const,
      categoryId: 7,
    };
    const source = { id: "9988", type: "djradio", name: "djradio" };

    expect(buildPlv(context, voice, source)).toMatchObject({
      id: "3081133072",
      type: "dj",
      sourceId: "9988",
      sourcetype: "djradio",
      categoryId: 7,
    });
    expect(buildPld(context, voice, source, 60)).toMatchObject({
      id: "3081133072",
      type: "dj",
      sourceId: "9988",
      sourcetype: "djradio",
      categoryId: 7,
    });
  });
});
