/**
 * 点赞、歌单收藏等系统通知
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const msg_notices: NeteaseModule = (query, request) => {
  const data = {
    limit: query.limit ?? 30,
    time: query.lasttime ?? -1,
  };
  return request("/api/msg/notices", data, createOption(query, "weapi"));
};

export default msg_notices;
