/**
 * 查询当前账号与指定用户是否互相关注
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const userMutualFollowGet: NeteaseModule = (query, request) =>
  request("/api/user/mutualfollow/get", { friendid: query.uid }, createOption(query));

export default userMutualFollowGet;
