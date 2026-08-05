/**
 * 删除资源评论
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const commentDelete: NeteaseModule = (query, request) =>
  request(
    "/api/resource/comments/delete",
    {
      threadId: query.thread_id,
      commentId: query.comment_id,
    },
    createOption(query, "xeapi"),
  );

export default commentDelete;
