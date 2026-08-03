import { describe, expect, it } from "vitest";
import { normalizePrivateHistory } from "./netease-message";

describe("私信资源卡片", () => {
  it("保留歌曲资源类型和 ID", () => {
    const page = normalizePrivateHistory(
      {
        msgs: [
          {
            id: 1,
            fromUser: { userId: 2 },
            time: 1000,
            msg: JSON.stringify({
              msg: "分享歌曲",
              song: { id: 101, name: "歌曲", artists: [{ name: "歌手" }] },
            }),
          },
        ],
      },
      1,
    );

    expect(page.items[0].resource).toMatchObject({ kind: "song", id: "101", title: "歌曲" });
  });

  it("保留专辑资源类型和 ID", () => {
    const page = normalizePrivateHistory(
      {
        msgs: [
          {
            id: 2,
            fromUser: { userId: 2 },
            time: 2000,
            msg: JSON.stringify({
              msg: "发布新专辑",
              album: { id: 202, name: "专辑", artist: { name: "歌手" } },
            }),
          },
        ],
      },
      1,
    );

    expect(page.items[0].resource).toMatchObject({ kind: "album", id: "202", title: "专辑" });
  });

  it("保留歌单资源类型和 ID", () => {
    const page = normalizePrivateHistory(
      {
        msgs: [
          {
            id: 3,
            fromUser: { userId: 2 },
            time: 3000,
            msg: JSON.stringify({
              msg: "分享歌单",
              playlist: { id: 303, name: "歌单", creator: { nickname: "用户" } },
            }),
          },
        ],
      },
      1,
    );

    expect(page.items[0].resource).toMatchObject({
      kind: "playlist",
      id: "303",
      title: "歌单",
    });
  });
});
