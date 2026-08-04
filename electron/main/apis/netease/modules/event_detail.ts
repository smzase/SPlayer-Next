/**
 * 获取动态详情
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventDetail: NeteaseModule = (query, request) =>
  request(`/api/v1/event/${query.uid}/${query.id}`, {}, createOption(query, "weapi"));

export default eventDetail;
