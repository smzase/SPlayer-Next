/**
 * 回复当前用户的评论消息
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const msg_comments: NeteaseModule = (query, request) => {
  const data = {
    beforeTime: query.before ?? -1,
    limit: query.limit ?? 30,
    total: "true",
    uid: query.uid,
  };
  return request(`/api/v1/user/comments/${query.uid}`, data, createOption(query, "weapi"));
};

export default msg_comments;
