import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import commentAdd from "./comment_add";
import commentDelete from "./comment_delete";
import commentLike from "./comment_like";
import commentReply from "./comment_reply";

const request = (): ReturnType<typeof vi.fn> =>
  vi.fn().mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] });

describe("网易云评论写操作", () => {
  it("使用资源线程发布和回复评论", async () => {
    const invoke = request();
    const query = {
      thread_id: "R_SO_4_1",
      comment_id: "2",
      content: "测试",
    } satisfies Query;

    await commentAdd(query, invoke as unknown as RequestFn);
    await commentReply(query, invoke as unknown as RequestFn);

    expect(invoke.mock.calls[0]?.slice(0, 2)).toEqual([
      "/api/resource/comments/add",
      {
        threadId: "R_SO_4_1",
        content: "测试",
        resourceType: "0",
        expressionPicId: "-1",
        bubbleId: "-1",
      },
    ]);
    expect(invoke.mock.calls[1]?.slice(0, 2)).toEqual([
      "/api/v1/resource/comments/reply",
      {
        threadId: "R_SO_4_1",
        commentId: "2",
        content: "测试",
        resourceType: "0",
      },
    ]);
  });

  it("删除指定评论", async () => {
    const invoke = request();

    await commentDelete(
      { thread_id: "A_PL_0_1", comment_id: "2" } satisfies Query,
      invoke as unknown as RequestFn,
    );

    expect(invoke.mock.calls[0]?.slice(0, 2)).toEqual([
      "/api/resource/comments/delete",
      { threadId: "A_PL_0_1", commentId: "2" },
    ]);
  });

  it("按当前状态点赞或取消点赞", async () => {
    const invoke = request();

    await commentLike(
      { thread_id: "R_AL_3_1", comment_id: "2", like: true } satisfies Query,
      invoke as unknown as RequestFn,
    );
    await commentLike(
      { thread_id: "R_AL_3_1", comment_id: "2", like: false } satisfies Query,
      invoke as unknown as RequestFn,
    );

    expect(invoke.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/comment/like",
      "/api/v1/comment/unlike",
    ]);
  });
});
