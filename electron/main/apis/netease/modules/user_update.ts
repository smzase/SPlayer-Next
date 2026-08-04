/**
 * 更新当前用户资料
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const userUpdate: NeteaseModule = (query, request) =>
  request(
    "/api/user/profile/update",
    {
      birthday: query.birthday,
      city: query.city,
      gender: query.gender,
      nickname: query.nickname,
      province: query.province,
      signature: query.signature,
    },
    createOption(query),
  );

export default userUpdate;
