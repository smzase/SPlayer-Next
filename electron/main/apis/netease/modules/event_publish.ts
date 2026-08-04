/**
 * 发布带资源的音乐笔记
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const eventPublish: NeteaseModule = (query, request) => {
  const data: Record<string, unknown> = {
    type: query.type,
    id: query.id,
    msg: query.text ?? "",
    active: true,
    uuid: query.uuid ?? Date.now(),
  };
  if (query.pics) data.pics = query.pics;
  return request("/api/share/friends/resource/", data, createOption(query, "xeapi"));
};

export default eventPublish;
