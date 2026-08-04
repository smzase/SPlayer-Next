/**
 * 删除动态评论
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventCommentDelete: NeteaseModule = (query, request) =>
  request(
    "/api/resource/comments/delete",
    {
      threadId: query.thread_id,
      commentId: query.comment_id,
    },
    createOption(query, "xeapi"),
  );

export default eventCommentDelete;
