/**
 * 发送文本私信
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const send_text: NeteaseModule = (query, request) => {
  const data = {
    type: "text",
    msg: query.msg,
    userIds: `[${query.user_ids}]`,
  };
  return request("/api/msg/private/send", data, createOption(query));
};

export default send_text;
