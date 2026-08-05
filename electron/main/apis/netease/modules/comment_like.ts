/**
 * 点赞或取消点赞资源评论
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const commentLike: NeteaseModule = (query, request) =>
  request(
    query.like === false ? "/api/v1/comment/unlike" : "/api/v1/comment/like",
    {
      threadId: query.thread_id,
      commentId: query.comment_id,
    },
    createOption(query, "weapi"),
  );

export default commentLike;
