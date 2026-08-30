/**
 * QM 用户基础资料模块
 *
 * 通过登录 Cookie 中的 uin 及 Web 官方 CGI 接口获取用户信息
 */

import { getQQMusicCookies, getQQMusicUin } from "../core/request";
import { coreLog } from "@main/utils/logger";
import type { QMModule } from "../core/types";

interface ProfileHomepageResp {
  code?: number;
  subcode?: number;
  data?: {
    creator?: {
      nick?: string;
      headpic?: string;
      icon?: string;
      vip?: number;
      vip_level?: number;
      is_vip?: number;
      is_super_vip?: number;
    };
  };
}

const WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const userDetail: QMModule = async (_params) => {
  const cookies = getQQMusicCookies();
  const uin = getQQMusicUin();

  const hasKey = !!(
    cookies.qm_keyst ||
    cookies.qqmusic_key ||
    cookies.pskey ||
    cookies.p_skey ||
    cookies.skey
  );

  if (!uin || uin === "0" || !hasKey) {
    return {
      code: 301,
      loggedIn: false,
      message: "未登录 QM 账号",
    };
  }

  const defaultAvatar = `https://q.qlogo.cn/headimg_dl?dst_uin=${uin}&spec=100`;

  try {
    const cookieEntries = Object.entries(cookies).filter(([_, v]) => !!v);
    const cookieStr = cookieEntries.map(([k, v]) => `${k}=${v}`).join("; ");

    const url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&userid=${encodeURIComponent(
      uin,
    )}&reqfrom=1&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq.json&needNewCode=0`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Referer: "https://y.qq.com/",
        Origin: "https://y.qq.com",
        "User-Agent": WEB_UA,
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });

    const json = (await res.json()) as ProfileHomepageResp;
    const creator = json.data?.creator;

    if (json.code === 0 && creator) {
      const nickname = creator.nick || `QQ用户_${uin.slice(-4)}`;
      const avatarUrl = creator.headpic || defaultAvatar;
      const isVip = !!(creator.is_vip || creator.is_super_vip || (creator.vip && creator.vip > 0));

      coreLog.info("[qm-user-detail] 成功获取用户资料:", {
        uin,
        nickname,
        isVip,
        vipLevel: creator.vip_level ?? 0,
      });

      return {
        code: 200,
        loggedIn: true,
        profile: {
          userId: uin,
          nickname,
          avatarUrl,
          isVip,
          vipLevel: creator.vip_level ?? 0,
        },
      };
    }

    throw new Error(`Web 接口返回异常: code=${json.code}, subcode=${json.subcode}`);
  } catch (err) {
    coreLog.warn("[qm-user-detail] 官方接口调用失败，使用基础 UIN 兜底资料:", {
      uin,
      hasKey,
      cookieKeys: Object.keys(cookies),
      err,
    });
    return {
      code: 200,
      loggedIn: true,
      profile: {
        userId: uin,
        nickname: `QQ用户_${uin.slice(-4)}`,
        avatarUrl: defaultAvatar,
        isVip: false,
      },
    };
  }
};

export default userDetail;
