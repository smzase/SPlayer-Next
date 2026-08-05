/**
 * 听歌打卡
 *
 * 更新网易云听歌排行数据，需要登录态。
 */

import { createOption } from "../core/option";
import { CLIENT_LOG_DOMAIN } from "../core/config";
import type { NeteaseModule } from "../core/types";

const scrobble: NeteaseModule = async (query, request) => {
  let cookie: string | Record<string, string> = query.cookie || "";
  if (typeof cookie === "object") {
    cookie = Object.assign({ os: "osx" }, cookie);
  } else if (typeof cookie === "string") {
    cookie = cookie.includes("os=") ? cookie.replace(/os=[^;]+/g, "os=osx") : `${cookie}; os=osx`;
  } else {
    cookie = "os=osx";
  }
  query.cookie = cookie;
  const sourceType = typeof query.sourceType === "string" ? query.sourceType : "song";
  const sourceName =
    sourceType === "song" ? "track" : sourceType === "radio" ? "djradio" : sourceType;

  const startplayData = {
    logs: JSON.stringify([
      {
        action: "startplay",
        json: {
          id: query.id,
          type: "song",
          mainsite: "1",
          mainsiteWeb: "1",
          content: `id=${query.sourceid}`,
        },
      },
    ]),
  };

  const playData = {
    logs: JSON.stringify([
      {
        action: "play",
        json: {
          download: 0,
          end: "playend",
          id: query.id,
          sourceId: query.sourceid,
          time: query.time,
          type: "song",
          wifi: 0,
          source: sourceName,
          mainsite: "1",
          mainsiteWeb: "1",
          content: `id=${query.sourceid}`,
        },
      },
    ]),
  };

  const option = createOption(query, "eapi");
  option.domain = CLIENT_LOG_DOMAIN;

  const startplay = await request("/api/feedback/weblog", startplayData, option);
  const play = await request("/api/feedback/weblog", playData, option);

  return {
    status: 200,
    body: {
      code: 200,
      data: "success",
      details: {
        startplay: startplay.body,
        play: play.body,
      },
    },
    cookie: [],
  };
};

export default scrobble;
