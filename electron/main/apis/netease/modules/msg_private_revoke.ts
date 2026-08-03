import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const msg_private_revoke: NeteaseModule = (query, request) => {
  return request(
    "/api/communication/msg/withdraw",
    {
      msgId: query.id,
      scene: 1,
    },
    createOption(query),
  );
};

export default msg_private_revoke;
