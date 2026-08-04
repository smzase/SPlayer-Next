/**
 * 获取指定用户的历史动态
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventUserHistory: NeteaseModule = (query, request) =>
  request(
    `/api/event/get/${query.uid}`,
    {
      getcounts: true,
      time: query.lasttime ?? -1,
      limit: query.limit ?? 30,
      total: false,
      fromRN: "true",
    },
    createOption(query),
  );

export default eventUserHistory;
