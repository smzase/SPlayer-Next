/**
 * 回复资源评论
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const commentReply: NeteaseModule = (query, request) =>
  request(
    "/api/v1/resource/comments/reply",
    {
      threadId: query.thread_id,
      commentId: query.comment_id,
      content: query.content,
      resourceType: "0",
    },
    createOption(query, "xeapi"),
  );

export default commentReply;
