/**
 * 点赞或取消点赞动态
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventLike: NeteaseModule = (query, request) =>
  request(
    query.like === false ? "/api/resource/unlike" : "/api/resource/like",
    { threadId: query.thread_id },
    createOption(query, "weapi"),
  );

export default eventLike;
