import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import commentHot from "./comment_hot";
import commentMusic from "./comment_music";

describe("网易云资源评论", () => {
  it("默认请求歌曲评论", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, body: {}, cookie: [] });

    await commentMusic({ id: "1" } satisfies Query, request as unknown as RequestFn);

    expect(request).toHaveBeenCalledWith(
      "/api/v1/resource/comments/R_SO_4_1",
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("按资源前缀请求歌单或专辑评论", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, body: {}, cookie: [] });

    await commentMusic(
      { id: "2", type: "A_PL_0_" } satisfies Query,
      request as unknown as RequestFn,
    );
    await commentMusic(
      { id: "3", type: "R_AL_3_" } satisfies Query,
      request as unknown as RequestFn,
    );
    await commentMusic(
      { id: "4", type: "A_DJ_1_" } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/resource/comments/A_PL_0_2",
      "/api/v1/resource/comments/R_AL_3_3",
      "/api/v1/resource/comments/A_DJ_1_4",
    ]);
  });

  it("热门评论沿用对应的资源前缀", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, body: {}, cookie: [] });

    await commentHot({ id: "4", type: "A_PL_0_" } satisfies Query, request as unknown as RequestFn);

    expect(request.mock.calls[0]?.[0]).toBe("/api/v1/resource/hotcomments/A_PL_0_4");
  });
});
