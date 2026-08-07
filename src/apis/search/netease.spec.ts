import { beforeEach, describe, expect, it, vi } from "vitest";
import { lyrics, notes, users } from "./netease";

const call = vi.fn();

beforeEach(() => {
  call.mockReset();
  Object.defineProperty(window, "api", {
    configurable: true,
    value: { apis: { call } },
  });
});

describe("网易云扩展搜索", () => {
  it("转换歌词与用户搜索结果", async () => {
    call
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          result: {
            songCount: 1,
            songs: [
              {
                id: 1,
                name: "歌词歌曲",
                duration: 1000,
                artists: [{ id: 2, name: "歌手" }],
                album: { id: 3, name: "专辑" },
                lyrics: ["<b>命中</b>的歌词", ""],
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          result: {
            userprofileCount: 1,
            userprofiles: [
              {
                userId: 4,
                nickname: "用户",
                avatarUrl: "https://example.com/avatar.jpg",
                followed: true,
                followMe: true,
              },
            ],
          },
        },
      });

    const lyricPage = await lyrics("歌词", 0, 20);
    const userPage = await users("用户", 0, 20);

    expect(lyricPage.items[0]).toMatchObject({
      track: { id: "1", title: "歌词歌曲" },
      lyrics: ["命中的歌词"],
    });
    expect(userPage.items[0]).toMatchObject({
      id: 4,
      name: "用户",
      followed: true,
      mutual: true,
    });
  });

  it("保留笔记搜索的游标与会话", async () => {
    call.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        data: {
          event: [
            {
              mappingEventId: "8",
              eventDataDTO: {
                type: 18,
                showTime: 1000,
                user: { userId: 9, nickname: "发布者" },
                json: JSON.stringify({ msg: "笔记正文" }),
                info: { likedCount: 2, commentCount: 3 },
              },
            },
          ],
          cursor: "cursor-2",
          more: true,
          sessionId: "session-2",
        },
      },
    });

    const page = await notes("笔记", 0, 20, {
      searchUuid: "uuid",
      currentUserId: 9,
    });

    expect(page.items[0]).toMatchObject({
      id: "8",
      text: "笔记正文",
      own: true,
      user: { id: 9, name: "发布者" },
    });
    expect(page).toMatchObject({
      cursor: "cursor-2",
      sessionId: "session-2",
      searchUuid: "uuid",
      hasMore: true,
    });
  });
});
