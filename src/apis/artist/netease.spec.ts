import { describe, expect, it, vi } from "vitest";
import { fetchArtist } from "./netease";

describe("fetchArtist", () => {
  it("保留歌手绑定的网易云用户 ID", async () => {
    const call = vi.fn().mockImplementation((_platform: string, name: string) => {
      if (name === "artists") {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            artist: {
              id: 10,
              name: "测试歌手",
              accountId: 20,
            },
            hotSongs: [],
          },
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        body: { hotAlbums: [] },
      });
    });
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { apis: { call } },
    });

    const result = await fetchArtist("10");

    expect(result?.userId).toBe(20);
  });
});
