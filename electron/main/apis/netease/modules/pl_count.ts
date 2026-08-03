/**
 * 私信与通知未读数量
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const pl_count: NeteaseModule = (query, request) =>
  request("/api/pl/count", {}, createOption(query, "weapi"));

export default pl_count;
