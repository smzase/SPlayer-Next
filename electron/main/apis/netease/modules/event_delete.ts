/**
 * 删除自己的动态
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventDelete: NeteaseModule = (query, request) =>
  request("/api/event/delete", { id: query.id }, createOption(query, "weapi"));

export default eventDelete;
