/**
 * 当前账号关注列表的混合分类
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const userFollowMixed: NeteaseModule = (query, request) => {
  const size = query.size ?? 30;
  return request(
    "/api/user/follow/users/mixed/get/v2",
    {
      authority: "false",
      page: JSON.stringify({ size, cursor: query.cursor ?? 0 }),
      scene: query.scene ?? 0,
      size,
      sortType: "0",
    },
    createOption(query),
  );
};

export default userFollowMixed;
