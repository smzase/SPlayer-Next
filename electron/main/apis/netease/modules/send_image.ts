/**
 * 上传并发送图片私信
 */

import { fetchWithProxy } from "@main/utils/proxy";
import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const IMAGE_BUCKET = "yyimgs";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const send_image: NeteaseModule = async (query, request) => {
  const bytes = query.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new Error("图片数据无效");
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("图片不能超过 10 MB");

  const mimeType = String(query.mime_type || "");
  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extensionByMime[mimeType];
  if (!ext) throw new Error("仅支持 JPEG、PNG、WebP 或 GIF 图片");

  const uploadBody = Uint8Array.from(bytes).buffer;
  const tokenResponse = await request(
    "/api/nos/token/alloc",
    {
      bucket: IMAGE_BUCKET,
      ext: "jpg",
      filename: String(query.name || `message.${ext}`),
      local: false,
      nos_product: 0,
      return_body: '{"code":200,"size":"$(ObjectSize)"}',
      type: "other",
    },
    createOption(query, "weapi"),
  );
  const result = tokenResponse.body.result as
    | { docId?: unknown; objectKey?: unknown; token?: unknown }
    | undefined;
  const objectKey = String(result?.objectKey || "");
  const token = String(result?.token || "");
  const imageId = String(result?.docId || "");
  if (!objectKey || !token || !imageId) throw new Error("获取图片上传凭证失败");

  const uploadResponse = await fetchWithProxy(
    `https://nosup-hz1.127.net/${IMAGE_BUCKET}/${objectKey}?offset=0&complete=true&version=1.0`,
    {
      method: "POST",
      headers: {
        "x-nos-token": token,
        "Content-Type": mimeType,
      },
      body: uploadBody,
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!uploadResponse.ok) {
    throw new Error(`图片上传失败（${uploadResponse.status}）`);
  }

  return request(
    "/api/msg/private/send",
    {
      type: "pic",
      userIds: `[${query.user_ids}]`,
      picinfo: JSON.stringify({
        picIdStr: imageId,
        width: Number(query.width),
        height: Number(query.height),
        format: ext,
        type: 0,
      }),
    },
    createOption(query),
  );
};

export default send_image;
