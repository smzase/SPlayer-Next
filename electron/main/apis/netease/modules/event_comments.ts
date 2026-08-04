/**
 * 获取动态评论
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventComments: NeteaseModule = (query, request) =>
  request(
    `/api/v1/resource/comments/${query.thread_id}`,
    {
      limit: query.limit ?? 30,
      offset: query.offset ?? 0,
      beforeTime: query.before ?? 0,
    },
    createOption(query, "weapi"),
  );

export default eventComments;
