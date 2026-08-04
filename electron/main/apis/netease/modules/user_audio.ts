/**
 * 用户创建的播客
 *
 * params:
 * - uid 用户 ID
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const userAudio: NeteaseModule = (query, request) =>
  request("/api/djradio/get/byuser", { userId: query.uid }, createOption(query, "weapi"));

export default userAudio;
