/**
 * 关注或取消关注用户
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const follow: NeteaseModule = (query, request) => {
  const action = Number(query.t) === 1 ? "follow" : "delfollow";
  return request("/api/user/" + action + "/" + query.id, {}, createOption(query, "weapi"));
};

export default follow;
