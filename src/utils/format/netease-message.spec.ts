import { describe, expect, it } from "vitest";
import {
  normalizeActivityMessages,
  normalizePrivateHistory,
  normalizePrivateThreads,
  normalizeUnreadCounts,
} from "./netease-message";

describe("picInfo private message", () => {
  it("parses direct picInfo", () => {
    const page = normalizePrivateHistory(
      {
        msgs: [
          {
            id: 4,
            fromUser: { userId: 1 },
            time: 3000,
            msg: JSON.stringify({
              type: 3,
              picInfo: { originUrl: "direct-picture", width: 1920, height: 1080 },
            }),
          },
        ],
      },
      1,
    );

    expect(page.items[0].image).toEqual({
      url: "direct-picture?param=640y640",
      width: 1920,
      height: 1080,
    });
  });

  it("parses wrapped string picinfo", () => {
    const page = normalizePrivateHistory(
      {
        msgs: [
          {
            id: 5,
            fromUser: { userId: 1 },
            time: 4000,
            msg: JSON.stringify({
              msg: JSON.stringify({
                type: 3,
                picinfo: JSON.stringify({
                  picUrl: "wrapped-picture",
                  width: 640,
                  height: 360,
                }),
              }),
            }),
          },
        ],
      },
      1,
    );

    expect(page.items[0].image).toEqual({
      url: "wrapped-picture?param=640y640",
      width: 640,
      height: 360,
    });
  });
});

describe("网易云消息格式化", () => {
  it("合并通知与关注数量并保留四类未读", () => {
    expect(
      normalizeUnreadCounts({ privateMsg: 2, comment: 3, forward: 4, notice: 5, follow: 1 }),
    ).toEqual({ private: 2, comment: 3, mention: 4, notice: 6 });
  });

  it("从私信会话中选择对方并解析 JSON 消息", () => {
    const page = normalizePrivateThreads(
      {
        more: true,
        msgs: [
          {
            id: 10,
            fromUser: { userId: 1, nickname: "我" },
            toUser: { userId: 2, nickname: "云小编", avatarUrl: "avatar" },
            lastMsg: JSON.stringify({ msg: "审核已经完成" }),
            lastMsgTime: 1234,
            newMsgCount: 2,
          },
        ],
      },
      1,
    );

    expect(page.more).toBe(true);
    expect(page.items[0]).toMatchObject({
      user: { userId: 2, nickname: "云小编" },
      lastMessage: "审核已经完成",
      unreadCount: 2,
    });
  });

  it("按时间排列私信历史并解析歌曲卡片", () => {
    const page = normalizePrivateHistory(
      {
        msgs: [
          {
            id: 2,
            fromUser: { userId: 2 },
            time: 2000,
            msg: JSON.stringify({
              msg: "分享一首歌",
              song: { name: "测试歌曲", artists: [{ name: "测试歌手" }], picUrl: "cover" },
            }),
          },
          { id: 1, fromUser: { userId: 1 }, time: 1000, msg: '{"msg":"你好"}' },
        ],
      },
      1,
    );

    expect(page.items.map((item) => item.id)).toEqual(["1", "2"]);
    expect(page.items[0].mine).toBe(true);
    expect(page.items[1].resource).toEqual({
      title: "测试歌曲",
      subtitle: "测试歌手",
      imageUrl: "cover?param=128y128",
    });
  });

  it("解析私信会话与历史中的图片消息", () => {
    const rawMessage = JSON.stringify({
      type: "image",
      msg: JSON.stringify({ picUrl: "picture", width: 1280, height: 720, msg: "截图" }),
    });
    const threads = normalizePrivateThreads(
      {
        msgs: [
          {
            fromUser: { userId: 2, nickname: "图片发送者" },
            toUser: { userId: 1, nickname: "我" },
            lastMsg: rawMessage,
            lastMsgTime: 2000,
          },
        ],
      },
      1,
    );
    const history = normalizePrivateHistory(
      { msgs: [{ id: 3, fromUser: { userId: 2 }, time: 2000, msg: rawMessage }] },
      1,
    );

    expect(threads.items[0]).toMatchObject({
      lastMessage: "截图",
      lastMessageIsImage: true,
    });
    expect(history.items[0].image).toEqual({
      url: "picture?param=640y640",
      width: 1280,
      height: 720,
    });
    expect(history.items[0].text).toBe("截图");
  });

  it("提取评论回复、原评论与资源名称", () => {
    const page = normalizeActivityMessages(
      {
        comments: [
          {
            resourceInfo: { name: "测试歌曲" },
            comment: {
              commentId: 7,
              user: { userId: 2, nickname: "回复者" },
              content: "这是回复",
              time: 3000,
              beReplied: [{ content: "这是原评论" }],
            },
          },
        ],
      },
      "comment",
    );

    expect(page.items[0]).toMatchObject({
      kind: "commentReply",
      text: "这是回复",
      detail: "这是原评论",
      resource: { title: "测试歌曲" },
    });
  });

  it("提取点赞通知中的原评论内容", () => {
    const page = normalizeActivityMessages(
      {
        notices: [
          {
            time: 4000,
            notice: JSON.stringify({
              type: 2,
              user: { userId: 2, nickname: "点赞用户" },
              comment: { commentId: 8, content: "终于等到苍新歌力！！！今晚我就……" },
            }),
          },
        ],
      },
      "notice",
    );

    expect(page.items[0]).toMatchObject({
      kind: "likedComment",
      detail: "终于等到苍新歌力！！！今晚我就……",
    });
    expect(page.items[0].resource).toBeUndefined();
  });
});
