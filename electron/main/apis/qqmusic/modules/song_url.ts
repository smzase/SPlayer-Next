/**
 * QM 单曲播放链接解析模块
 */

import { getQQMusicCookies, getQQMusicUin } from "../core/request";
import { QM_API_URL } from "../core/config";
import { coreLog } from "@main/utils/logger";
import type { QMModule } from "../core/types";

interface QualityCandidate {
  prefix: string;
  ext: string;
  level: string;
  label: string;
}

const QQ_QUALITY_CANDIDATE_TEMPLATES: QualityCandidate[] = [
  { prefix: "AI00", ext: ".flac", level: "hi-res", label: "Hi-Res FLAC" },
  { prefix: "F000", ext: ".flac", level: "lossless", label: "无损 FLAC" },
  { prefix: "M800", ext: ".mp3", level: "hq", label: "320k MP3" },
  { prefix: "M500", ext: ".mp3", level: "sq", label: "128k MP3" },
  { prefix: "C400", ext: ".m4a", level: "lq", label: "标准 AAC" },
];

/**
 * 根据用户的首选音质生成顺位候选列表
 */
const getQualityCandidates = (preferredLevel: string): QualityCandidate[] => {
  const target = String(preferredLevel || "hq").toLowerCase();
  const targetIndex = QQ_QUALITY_CANDIDATE_TEMPLATES.findIndex((t) => t.level === target);
  if (targetIndex >= 0) {
    return QQ_QUALITY_CANDIDATE_TEMPLATES.slice(targetIndex);
  }
  return QQ_QUALITY_CANDIDATE_TEMPLATES;
};

const WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface MidUrlInfo {
  songmid: string;
  filename: string;
  purl?: string;
  result?: number;
  errtype?: string;
}

interface FcgVkeyResponse {
  code?: number;
  req_0?: {
    code?: number;
    data?: {
      retcode?: number;
      msg?: string;
      sip?: string[];
      midurlinfo?: MidUrlInfo[];
    };
  };
}

/** 极速探测音频直链在 CDN 上是否真实存在 (仅读取 1 字节状态码) */
const probeAudioUrl = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
        Referer: "https://y.qq.com/",
        "User-Agent": WEB_UA,
      },
      signal: AbortSignal.timeout(1200),
    });
    return res.status === 200 || res.status === 206;
  } catch {
    return false;
  }
};

const songUrl: QMModule = async (params) => {
  const mid = String(params.mid || params.id || "").trim();
  if (!mid) return { code: 400, message: "missing mid" };
  const mediaMid = String(params.mediaMid || mid).trim();

  const targetLevel = String(params.level || "hq");
  const candidates = getQualityCandidates(targetLevel);
  const filenames = candidates.map((c) => `${c.prefix}${mediaMid}${c.ext}`);

  const cookies = getQQMusicCookies();
  const uin = getQQMusicUin();
  const playbackKey =
    cookies.qm_keyst ||
    cookies.qqmusic_key ||
    cookies.music_key ||
    cookies.wxskey ||
    cookies.pskey ||
    "";
  const hasAuth = !!playbackKey;

  // 8 位随机数字 guid
  const guid = String(10000000 + Math.floor(Math.random() * 90000000));

  coreLog.debug("[qm-song-url] 发起直链解析:", mid, targetLevel);

  const reqBody = {
    comm: {
      uin: uin && uin !== "0" ? Number(uin) || uin : 0,
      format: "json",
      ct: hasAuth ? 19 : 24,
      cv: 0,
      ...(hasAuth ? { authst: playbackKey } : {}),
    },
    req_0: {
      module: "vkey.GetVkeyServer",
      method: "CgiGetVkey",
      param: {
        guid,
        songmid: filenames.map(() => mid),
        songtype: filenames.map(() => 0),
        uin: String(uin),
        loginflag: 1,
        platform: "20",
        filename: filenames,
      },
    },
  };

  const cookieEntries = Object.entries(cookies).filter(([_, v]) => !!v);
  const cookieStr = cookieEntries.map(([k, v]) => `${k}=${v}`).join("; ");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Referer: "https://y.qq.com/",
    Origin: "https://y.qq.com",
    "User-Agent": WEB_UA,
  };
  if (cookieStr) {
    headers.Cookie = cookieStr;
  }

  try {
    const res = await fetch(QM_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(8000),
    });

    const json = (await res.json()) as FcgVkeyResponse;
    const data = json.req_0?.data;
    const infos = data?.midurlinfo || [];

    // 优先使用接口返回的 HTTPS 流媒体节点
    const rawSips = data?.sip?.filter((sip) => sip.startsWith("https://")) ?? [];
    const sip = rawSips[0] ?? "https://ws.stream.qqmusic.qq.com/";

    coreLog.debug("[qm-song-url] 接口返回状态:", {
      code: json.req_0?.code,
      retcode: data?.retcode,
      count: infos.length,
    });

    const availableCandidates = candidates.flatMap((cand) => {
      const matchFilename = `${cand.prefix}${mediaMid}${cand.ext}`;
      const found = infos.find((item) => item.filename === matchFilename && !!item.purl);
      return found?.purl ? [{ cand, url: `${sip}${found.purl}` }] : [];
    });

    // 按音质顺位最多探测四个候选，首个可播放地址命中后立即返回
    let matched: (typeof availableCandidates)[number] | undefined;
    for (const candidate of availableCandidates.slice(0, 4)) {
      if (await probeAudioUrl(candidate.url)) {
        matched = candidate;
        break;
      }
    }

    // 网络探测可能误判，交给播放器做最终校验并沿用既有插件兜底
    matched ??= availableCandidates[0];
    if (matched) {
      coreLog.info(
        `[qm-song-url] 成功命中直链: ${mid} -> ${matched.cand.label} (${matched.cand.level})`,
      );

      return {
        code: 200,
        data: [
          {
            id: mid,
            url: matched.url,
            level: matched.cand.level,
            format: matched.cand.ext.replace(".", ""),
            isFallback: matched.cand.level !== targetLevel,
          },
        ],
      };
    }

    coreLog.warn("[qm-song-url] 官方直链未探测到任何可用音质，转入插件兜底:", {
      mid,
      retcode: data?.retcode,
      msg: data?.msg,
    });

    return {
      code: 403,
      message: data?.msg || "无法获取播放链接，可能需要 VIP 或无版权",
      data: [{ id: mid, url: "" }],
    };
  } catch (err) {
    coreLog.error("[qm-song-url] 解析发生网络或系统异常:", err);
    return {
      code: 500,
      message: err instanceof Error ? err.message : String(err),
      data: [{ id: mid, url: "" }],
    };
  }
};

export default songUrl;
