/**
 * 转发动态
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventForward: NeteaseModule = (query, request) =>
  request(
    "/api/event/forward",
    {
      forwards: query.text ?? "",
      id: query.id,
      eventUserId: query.uid,
    },
    createOption(query),
  );

export default eventForward;
