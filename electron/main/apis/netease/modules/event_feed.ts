/**
 * 获取已关注用户的动态流
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventFeed: NeteaseModule = (query, request) => {
  const data = {
    cursor: query.cursor ?? -1,
    pagesize: query.pagesize ?? 20,
  };
  return request("/api/event/pc/history/feed/get", data, createOption(query, "weapi"));
};

export default eventFeed;
