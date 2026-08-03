/**
 * 指定用户的私信历史
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const msg_private_history: NeteaseModule = (query, request) => {
  const data = {
    userId: query.uid,
    limit: query.limit ?? 30,
    time: query.before ?? 0,
    total: "true",
  };
  return request("/api/msg/private/history", data, createOption(query, "weapi"));
};

export default msg_private_history;
