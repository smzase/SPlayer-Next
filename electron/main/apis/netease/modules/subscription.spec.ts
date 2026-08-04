import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import albumSub from "./album_sub";
import albumSublist from "./album_sublist";
import artistSub from "./artist_sub";
import artistSublist from "./artist_sublist";

const createRequest = () =>
  vi.fn().mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] });

describe("网易云收藏接口", () => {
  it("按目标状态收藏或取消收藏专辑", async () => {
    const request = createRequest();

    await albumSub({ id: "1", t: 1 } satisfies Query, request as unknown as RequestFn);
    await albumSub({ id: "1", t: 2 } satisfies Query, request as unknown as RequestFn);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/album/sub",
      "/api/album/unsub",
    ]);
  });

  it("按目标状态收藏或取消收藏歌手", async () => {
    const request = createRequest();

    await artistSub({ id: "2", t: 1 } satisfies Query, request as unknown as RequestFn);
    await artistSub({ id: "2", t: 2 } satisfies Query, request as unknown as RequestFn);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/artist/sub",
      "/api/artist/unsub",
    ]);
  });

  it("收藏列表请求携带防缓存时间戳", async () => {
    const request = createRequest();

    await albumSublist(
      { limit: 20, offset: 0, timestamp: 123 } satisfies Query,
      request as unknown as RequestFn,
    );
    await artistSublist(
      { limit: 20, offset: 0, timestamp: 456 } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request.mock.calls[0]?.[1]).toMatchObject({ timestamp: 123 });
    expect(request.mock.calls[1]?.[1]).toMatchObject({ timestamp: 456 });
  });
});
