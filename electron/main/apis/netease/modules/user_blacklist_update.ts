/**
 * 添加或解除用户黑名单
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const userBlacklistUpdate: NeteaseModule = async (query, request) => {
  const action = query.blacklisted ? "add" : "delete";
  return request("/api/blacklist/" + action, { userid: query.uid }, createOption(query, "eapi"));
};

export default userBlacklistUpdate;
