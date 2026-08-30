/**
 * QM 请求层
 *
 * 设计：
 * - 统一走 u.y.qq.com/cgi-bin/musicu.fcg 的 `{ comm, request: {module, method, param} }` 协议
 * - 首次请求前先调 music.getSession.session 拿 uid/sid/userip，缓存 1 小时
 * - 没有加密：API 本身明文 JSON POST，靠 UA + QIMEI36 等 comm 字段伪装客户端
 * - Referer 设为 https://y.qq.com，部分接口会校验
 */

import { QM_API_URL, QM_HEADERS, SESSION_TTL, getCommonParams } from "./config";
import {
  clearSessionCookies,
  getSessionCookies,
  saveSessionCookies,
} from "@main/database/sessions";
import { coreLog } from "@main/utils/logger";

/** Session 字段（可能缺失则下次请求会自动补拿） */
interface SessionCache {
  uid?: string;
  sid?: string;
  userip?: string;
  expireAt: number;
}

let session: SessionCache = { expireAt: 0 };
let initPromise: Promise<void> | null = null;
let userCookies: Record<string, string> | null = null;
let sessionGeneration = 0;

/** 使当前客户端会话失效，避免账号变化后继续复用旧会话 */
const invalidateSession = (): void => {
  sessionGeneration++;
  session = { expireAt: 0 };
};

/** 读取内存或数据库中的 QM cookies */
export const getQQMusicCookies = (): Record<string, string> => {
  if (userCookies !== null) return userCookies;
  userCookies = getSessionCookies("qqmusic");
  return userCookies;
};

/** 更新 QM cookies 并落库 */
export const mergeQQMusicCookies = (cookies: Record<string, string>): void => {
  const current = getQQMusicCookies();
  userCookies = { ...current, ...cookies };
  saveSessionCookies("qqmusic", userCookies);
  invalidateSession();
  coreLog.info("[qm-cookie] 更新并保存 Cookie 到数据库，包含字段:", Object.keys(userCookies));
};

/** 清空 QM cookies 登录态 */
export const clearQQMusicCookies = (): void => {
  userCookies = {};
  clearSessionCookies("qqmusic");
  invalidateSession();
  coreLog.info("[qm-cookie] 已从数据库中清空 QM Session");
};

/** 提取当前登录 uin（纯数字形式） */
export const getQQMusicUin = (): string => {
  const cookies = getQQMusicCookies();
  const raw = cookies.uin || cookies.wxuin || cookies.p_uin || "";
  return raw ? raw.replace(/^o/, "") : "0";
};

/** 重试次数与退避 */
const MAX_RETRY = 2;
const RETRY_BACKOFF = 300;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface FcgResponse {
  code?: number;
  request?: { code?: number; data?: unknown };
  [key: string]: unknown;
}

interface QMRequestOptions {
  /** 是否在请求前初始化客户端会话 */
  session?: boolean;
}

/** 发起一次 fcg POST（自动注入 Cookie） */
const postRaw = async (
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<FcgResponse> => {
  const cookies = getQQMusicCookies();
  const cookieEntries = Object.entries(cookies).filter(([_, v]) => !!v);
  const cookieStr =
    cookieEntries.length > 0
      ? cookieEntries.map(([k, v]) => `${k}=${v}`).join("; ")
      : QM_HEADERS.Cookie;

  const res = await fetch(QM_API_URL, {
    method: "POST",
    headers: {
      ...QM_HEADERS,
      ...(cookieStr ? { Cookie: cookieStr } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return (await res.json()) as FcgResponse;
};

/** 初始化 / 刷新 session（1h 过期）；并发安全：同一时刻只发一次 */
const ensureSession = (): Promise<void> => {
  if (session.uid && session.expireAt > Date.now()) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const generation = sessionGeneration;
    try {
      const uin = getQQMusicUin();
      const body = {
        comm: {
          ...getCommonParams(),
          ...(uin && uin !== "0" ? { uin } : {}),
        },
        request: {
          module: "music.getSession.session",
          method: "GetSession",
          param: { caller: 0, uid: uin, vkey: 0 },
        },
      };
      const data = await postRaw(body);
      if (generation === sessionGeneration && data.code === 0 && data.request?.code === 0) {
        const info =
          ((data.request.data as { session?: Partial<SessionCache> }) ?? {}).session ?? {};
        session = {
          uid: info.uid,
          sid: info.sid,
          userip: info.userip,
          expireAt: Date.now() + SESSION_TTL,
        };
      }
    } catch {
      // session 失败不阻塞后续调用，大部分接口无 session 也能回结果
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

/**
 * 发送一次 musicu.fcg 请求
 * @param module 业务 module（如 music.search.SearchCgiService）
 * @param method 业务 method（如 DoSearchForQQMusicMobile）
 * @param param  业务 param
 * @param options 请求选项
 * @returns request.data 的业务数据段
 */
export const qmRequest = async <T = unknown>(
  module: string,
  method: string,
  param: Record<string, unknown>,
  options: QMRequestOptions = {},
): Promise<T> => {
  const useSession = options.session !== false;
  if (useSession) await ensureSession();

  const uin = getQQMusicUin();
  const comm = {
    ...getCommonParams(),
    ...(uin && uin !== "0" ? { uin } : {}),
    ...(useSession && session.uid ? { uid: session.uid } : {}),
    ...(useSession && session.sid ? { sid: session.sid } : {}),
    ...(useSession && session.userip ? { userip: session.userip } : {}),
  };

  const body = { comm, request: { module, method, param } };

  // QM 后端偶发瞬时错误
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const data = await postRaw(body);
      const outerCode = data.code ?? 0;
      const innerCode = data.request?.code ?? 0;
      if (outerCode !== 0 || innerCode !== 0) {
        throw new Error(`QM API 错误: outer=${outerCode} inner=${innerCode}`);
      }
      return data.request?.data as T;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRY) await delay(RETRY_BACKOFF);
    }
  }
  throw lastErr;
};

/** 调试用：取当前 session 快照 */
export const getQMSession = (): Readonly<SessionCache> => session;
