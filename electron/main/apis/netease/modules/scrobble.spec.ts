import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import scrobble from "./scrobble";

const createRequest = () =>
  vi.fn().mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] });

describe("网易云原版日志听歌打卡", () => {
  it.each([
    ["list", "list"],
    ["song", "track"],
    ["radio", "djradio"],
  ])("将 %s 来源映射为官方 %s 类型", async (sourceType, expected) => {
    const request = createRequest();

    await scrobble(
      {
        id: "123",
        sourceid: "456",
        sourceType,
        time: 60,
        cookie: {},
      } satisfies Query,
      request as unknown as RequestFn,
    );

    const playData = request.mock.calls[1]?.[1] as { logs: string };
    const logs = JSON.parse(playData.logs);
    expect(logs[0].json).toMatchObject({
      id: "123",
      sourceId: "456",
      source: expected,
    });
  });
});
