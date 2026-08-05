import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import recentPlay from "./recent_play";
import recentPlayRemove from "./recent_play_remove";

const createRequest = () =>
  vi.fn().mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] });

describe("网易云多端最近播放接口", () => {
  it("按资源类型请求对应的 weapi 列表", async () => {
    const request = createRequest();
    const kinds = ["song", "voice", "playlist", "album", "podcast"] as const;

    for (const kind of kinds) {
      await recentPlay({ kind, limit: 80 } satisfies Query, request as unknown as RequestFn);
    }

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/play-record/song/list",
      "/api/play-record/voice/list",
      "/api/play-record/playlist/list",
      "/api/play-record/album/list",
      "/api/play-record/djradio/list",
    ]);
    for (const [, data, option] of request.mock.calls) {
      expect(data).toEqual({ limit: 80 });
      expect(option).toMatchObject({ crypto: "weapi" });
    }
  });

  it("批量移除时保留官方游标参数", async () => {
    const request = createRequest();

    await recentPlayRemove(
      {
        resourceIds: JSON.stringify(["1", "2"]),
        type: "PLAYLIST",
        lastPlayTime: 123456,
        lastResourceId: "9",
      } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request).toHaveBeenCalledWith(
      "/api/play-record/batch/delete",
      {
        resourceIds: '["1","2"]',
        type: "PLAYLIST",
        lastPlayTime: 123456,
        lastResourceId: "9",
      },
      expect.objectContaining({ crypto: "weapi" }),
    );
  });
});
