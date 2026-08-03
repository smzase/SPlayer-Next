import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";

const { fetchWithProxyMock } = vi.hoisted(() => ({
  fetchWithProxyMock: vi.fn(),
}));

vi.mock("@main/utils/proxy", () => ({
  fetchWithProxy: fetchWithProxyMock,
}));

import sendImage from "./send_image";

describe("网易云图片私信", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("上传后将 docId 与图片尺寸写入 picinfo", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        body: {
          result: {
            docId: "image-doc-id",
            objectKey: "image-object-key",
            token: "upload-token",
          },
        },
        cookie: [],
      })
      .mockResolvedValueOnce({ status: 200, body: { code: 200 }, cookie: [] });
    fetchWithProxyMock.mockResolvedValue({ ok: true } as Response);

    await sendImage(
      {
        bytes: new Uint8Array([1, 2, 3]),
        mime_type: "image/png",
        name: "cover.png",
        user_ids: 456,
        width: 640,
        height: 360,
      } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request).toHaveBeenNthCalledWith(
      2,
      "/api/msg/private/send",
      {
        type: "pic",
        userIds: "[456]",
        picinfo: JSON.stringify({
          picIdStr: "image-doc-id",
          width: 640,
          height: 360,
          format: "png",
          type: 0,
        }),
      },
      expect.any(Object),
    );
  });
});
