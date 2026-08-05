/**
 * 多端最近播放列表
 *
 * kind: song / voice / playlist / album / podcast
 */

import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const endpoints: Record<string, string> = {
  song: "/api/play-record/song/list",
  voice: "/api/play-record/voice/list",
  playlist: "/api/play-record/playlist/list",
  album: "/api/play-record/album/list",
  podcast: "/api/play-record/djradio/list",
};

const recentPlay: NeteaseModule = (query, request) => {
  const kind = typeof query.kind === "string" ? query.kind : "";
  const endpoint = endpoints[kind];
  if (!endpoint) {
    return Promise.resolve({
      status: 400,
      body: { code: 400, msg: "不支持的最近播放类型" },
      cookie: [],
    });
  }
  const data = {
    limit: query.limit ?? 100,
  };
  return request(endpoint, data, createOption(query, "weapi"));
};

export default recentPlay;
