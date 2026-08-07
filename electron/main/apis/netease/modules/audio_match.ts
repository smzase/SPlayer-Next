import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const OFFICIAL_PC_VERSION = "3.1.37.205354";
const OFFICIAL_PC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.37.205354";

/** 使用最新版 PC 客户端参数提交听歌识曲指纹 */
const audioMatch: NeteaseModule = (query, request) => {
  const rawdata = typeof query.audioFP === "string" ? query.audioFP : "";
  if (!rawdata) {
    return Promise.resolve({
      status: 400,
      body: { code: 400, msg: "缺少音频指纹" },
      cookie: [],
    });
  }

  const duration = Math.min(16, Math.max(1, Math.round(Number(query.duration) || 4)));
  const times = Math.min(5, Math.max(1, Math.round(Number(query.times) || 1)));
  const sessionId = String(query.sessionId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  const cookie =
    typeof query.cookie === "object" && query.cookie
      ? { ...query.cookie, os: "pc", appver: OFFICIAL_PC_VERSION }
      : query.cookie;
  const option = createOption({ ...query, cookie, ua: OFFICIAL_PC_USER_AGENT }, "eapi");

  return request(
    "/api/music/audio/match",
    {
      algorithmCode: "shazam_v2",
      times,
      sessionId,
      duration,
      rawdata,
      from: "pc_back_discern",
      decrypt: "1",
    },
    option,
  );
};

export default audioMatch;
