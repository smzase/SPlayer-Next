import { describe, expect, it } from "vitest";
import { normalizeFollowComments, normalizeFollowFeed, normalizeFollowPost } from "./netease-event";

describe("normalizeFollowPost", () => {
  it("转换旧版资源动态", () => {
    const post = normalizeFollowPost(
      {
        id: 10,
        type: 18,
        showTime: 1000,
        user: { userId: 1, nickname: "用户" },
        info: { threadId: "A_EV_2_10_1", likedCount: 2, commentCount: 3 },
        json: JSON.stringify({
          msg: "分享一首歌",
          song: {
            id: 20,
            name: "歌曲",
            artists: [{ name: "歌手" }],
            album: { picUrl: "https://example.com/cover.jpg" },
          },
        }),
      },
      1,
    );

    expect(post?.own).toBe(true);
    expect(post?.resource).toMatchObject({
      kind: "song",
      id: "20",
      title: "歌曲",
      subtitle: "歌手",
    });
  });

  it("转换新版 Mlog 图片笔记", () => {
    const page = normalizeFollowFeed(
      {
        data: {
          cursor: 99,
          more: true,
          events: [
            {
              id: 11,
              type: 57,
              user: { userId: 2, nickname: "用户二" },
              json: {
                resource: {
                  mlogDetail: {
                    content: {
                      text: "新版笔记",
                      image: [{ imageUrl: "https://example.com/image.jpg", width: 800 }],
                      song: { id: 21, name: "新歌", ar: [{ name: "新歌手" }] },
                    },
                  },
                },
              },
            },
          ],
        },
      },
      1,
    );

    expect(page.more).toBe(true);
    expect(page.cursor).toBe(99);
    expect(page.items[0]).toMatchObject({ text: "新版笔记", own: false });
    expect(page.items[0].images).toHaveLength(1);
    expect(page.items[0].resource?.kind).toBe("song");
  });

  it("从转发动态中提取原资源", () => {
    const post = normalizeFollowPost(
      {
        id: 12,
        type: 22,
        user: { userId: 3, nickname: "转发者" },
        json: {
          msg: "推荐",
          event: {
            type: 19,
            json: JSON.stringify({ album: { id: 30, name: "专辑" } }),
          },
        },
      },
      1,
    );

    expect(post?.text).toBe("推荐");
    expect(post?.resource).toMatchObject({ kind: "album", id: "30", title: "专辑" });
  });
});

describe("normalizeFollowComments", () => {
  it("转换动态评论与被回复内容", () => {
    const page = normalizeFollowComments({
      comments: [
        {
          commentId: 1,
          user: { userId: 2, nickname: "评论者" },
          content: "回复",
          beReplied: [{ user: { nickname: "原作者" }, content: "原文" }],
        },
      ],
    });

    expect(page.items[0]).toMatchObject({
      id: "1",
      text: "回复",
      replyTo: { userName: "原作者", text: "原文" },
    });
  });
});

describe("normalizeFollowFeed", () => {
  it("转换旧版用户历史接口的 event 数组", () => {
    const page = normalizeFollowFeed(
      {
        event: [
          {
            id: 13,
            type: 18,
            showTime: 3000,
            user: { userId: 1, nickname: "当前用户" },
            json: JSON.stringify({ msg: "更早的笔记" }),
          },
        ],
        lasttime: 2000,
        more: true,
      },
      1,
    );

    expect(page).toMatchObject({ cursor: 2000, more: true });
    expect(page.items[0]).toMatchObject({ id: "13", text: "更早的笔记", own: true });
  });
});
