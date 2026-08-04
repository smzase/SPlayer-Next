/**
 * 发布动态评论
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventCommentAdd: NeteaseModule = (query, request) =>
  request(
    "/api/resource/comments/add",
    {
      threadId: query.thread_id,
      content: query.content,
      resourceType: "0",
      expressionPicId: "-1",
      bubbleId: "-1",
    },
    createOption(query, "xeapi"),
  );

export default eventCommentAdd;
