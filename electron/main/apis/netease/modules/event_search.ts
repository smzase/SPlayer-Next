/**
 * 搜索音乐笔记
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventSearch: NeteaseModule = (query, request) => {
  const data = {
    filters:
      typeof query.filters === "string" ? query.filters : JSON.stringify(query.filters ?? []),
    keyword: query.keyword ?? "",
    limit: String(query.limit ?? 20),
    offset: String(query.cursor ?? ""),
    passParams: query.passParams ?? "",
    scene: query.scene ?? "",
    searchUuid: query.searchUuid ?? "",
    sessionId: query.sessionId ?? "",
  };
  return request("/api/event/search/list/get/v1", data, createOption(query));
};

export default eventSearch;
