import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import eventSearch from "./event_search";

describe("网易云笔记搜索接口", () => {
  it("按手机客户端参数请求笔记搜索分页", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] });

    await eventSearch(
      {
        keyword: "测试",
        limit: 20,
        cursor: "next-cursor",
        sessionId: "session",
        searchUuid: "uuid",
        filters: "[]",
      } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request).toHaveBeenCalledWith(
      "/api/event/search/list/get/v1",
      {
        filters: "[]",
        keyword: "测试",
        limit: "20",
        offset: "next-cursor",
        passParams: "",
        scene: "",
        searchUuid: "uuid",
        sessionId: "session",
      },
      expect.objectContaining({ crypto: "" }),
    );
  });
});
