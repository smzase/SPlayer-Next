import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import revokePrivateMessage from "./msg_private_revoke";

describe("网易云私信撤回", () => {
  it("使用 communication 撤回接口与私信场景", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] });

    await revokePrivateMessage(
      { id: "message-id" } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request).toHaveBeenCalledWith(
      "/api/communication/msg/withdraw",
      { msgId: "message-id", scene: 1 },
      expect.any(Object),
    );
  });
});
