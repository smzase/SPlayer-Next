import type { KGModule } from "../core/types";
import { ensureKugouDfid } from "../core/device";
import { getDeviceMid, signKey } from "../core/crypto";
import { kgGatewayRequest } from "../core/request";
import { getSessionCookies } from "@main/database/sessions";
import { KG_APPID } from "../core/config";

const QUALITY_MAP: Record<string, number | string> = {
  "hi-res": "high",
  lossless: "flac",
  hq: 320,
  sq: 128,
  lq: 128,
};

const songUrl: KGModule = async (params) => {
  const hash = String(params.hash ?? "").toLowerCase();
  if (!hash) throw new Error("KG song hash missing");
  await ensureKugouDfid();
  const session = getSessionCookies("kugou");
  const userid = Number(session.userid || 0);
  const response = await kgGatewayRequest<Record<string, unknown>>("/v5/url", {
    params: {
      album_id: Number(params.albumId ?? 0),
      area_code: 1,
      hash,
      ssa_flag: "is_fromtrack",
      version: 11430,
      page_id: 151369488,
      quality: QUALITY_MAP[String(params.level ?? "hq")] ?? 320,
      album_audio_id: Number(params.audioId ?? 0),
      behavior: "play",
      pid: 2,
      cmd: 26,
      pidversion: 3001,
      IsFreePart: params.freePart ? 1 : 0,
      ppage_id: "463467626,350369493,788954147",
      cdnBackup: 1,
      module: "",
      clientver: 11430,
      key: signKey(hash, getDeviceMid(), userid, KG_APPID),
    },
    headers: { "x-router": "trackercdn.kugou.com" },
  });
  const urls = [response.url, response.backup_url]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  return {
    code: urls.length > 0 ? 200 : Number(response.errcode ?? 500),
    message: String(response.error ?? ""),
    data: urls.length > 0 ? { url: urls[0] } : undefined,
  };
};

export default songUrl;
