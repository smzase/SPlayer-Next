/**
 * 从多端最近播放中批量移除资源
 *
 * resourceIds 为 JSON 数组字符串，类型与列表最旧一项用于服务端游标修正。
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const recentPlayRemove: NeteaseModule = (query, request) => {
  const data = {
    resourceIds:
      typeof query.resourceIds === "string"
        ? query.resourceIds
        : JSON.stringify(query.resourceIds ?? []),
    type: query.type,
    lastPlayTime: query.lastPlayTime,
    lastResourceId: query.lastResourceId,
  };
  return request("/api/play-record/batch/delete", data, createOption(query, "weapi"));
};

export default recentPlayRemove;
