/**
 * 提及当前用户的消息
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const msg_forwards: NeteaseModule = (query, request) => {
  const data = {
    offset: query.offset ?? 0,
    limit: query.limit ?? 30,
    total: "true",
  };
  return request("/api/forwards/get", data, createOption(query, "weapi"));
};

export default msg_forwards;
