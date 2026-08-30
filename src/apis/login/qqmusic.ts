import { qqmusicCall } from "@/apis/qqmusic";
import type { PlatformProfile } from "@shared/types/platform";

interface UserDetailResponse {
  code: number;
  loggedIn: boolean;
  message?: string;
  profile?: PlatformProfile;
}

/**
 * 打开 QM 官方网页登录窗口
 * @returns 登录成功返回 true；用户取消或失败返回 false
 */
export const openQQMusicLoginWeb = async (): Promise<boolean> => {
  const res = await window.api.apis.openLoginWeb("qqmusic");
  return res.ok;
};

/**
 * 获取当前 QM 登录状态与用户资料
 * @returns 已登录返回 profile，未登录返回 null
 */
export const fetchQQMusicLoginStatus = async (): Promise<PlatformProfile | null> => {
  try {
    const data = await qqmusicCall<UserDetailResponse>("user_detail", {
      timestamp: Date.now(),
    });
    if (data?.code === 200 && data.loggedIn && data.profile) {
      return data.profile;
    }
    return null;
  } catch (err) {
    console.warn("[qqmusic] fetch login status failed:", err);
    return null;
  }
};

/**
 * 清除 QM 登录会话（登出）
 */
export const logoutQQMusic = async (): Promise<void> => {
  await window.api.apis.clearSession("qqmusic");
};

/**
 * 手动设置 QM Cookie
 * @param cookieString Cookie 字符串
 */
export const setQQMusicCookie = async (cookieString: string): Promise<boolean> => {
  const res = await window.api.apis.setCookie("qqmusic", cookieString);
  return res.ok;
};
