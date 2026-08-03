/**
 * 歌曲评论
 * params:
 * - id 资源 id
 * - type 网易云资源类型前缀，默认为歌曲 R_SO_4_
 * - limit 每页数量
 * - offset 偏移量
 * - before 超过 5000 条后的时间游标
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const comment_music: NeteaseModule = (query, request) => {
  const type = query.type ?? "R_SO_4_";
  const data = {
    rid: query.id,
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
    beforeTime: query.before ?? 0,
  };
  return request(
    `/api/v1/resource/comments/${type}${query.id}`,
    data,
    createOption(query, "weapi"),
  );
};

export default comment_music;
