/**
 * 私信会话列表
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const msg_private: NeteaseModule = (query, request) => {
  const data = {
    offset: query.offset ?? 0,
    limit: query.limit ?? 30,
    total: "true",
  };
  return request("/api/msg/private/users", data, createOption(query, "weapi"));
};

export default msg_private;
