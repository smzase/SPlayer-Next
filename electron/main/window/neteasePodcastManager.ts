import { BrowserWindow, session, shell } from "electron";
import { getNeteaseCookies } from "@main/apis/netease";
import { coreLog } from "@main/utils/logger";
import { getMainWindow } from "./main";
import { NETEASE_WEB_USER_AGENT } from "./login";

const PODCAST_MANAGER_URL = "https://music.163.com/st/ncreator/manage/voice/display";
const NETEASE_ORIGIN = "https://music.163.com";
const MANAGER_PARTITION = "persist:netease-podcast-manager";
const WEB_COOKIE_KEYS = ["MUSIC_U", "__csrf", "NMTID", "MUSIC_A"];

let managerWindow: BrowserWindow | null = null;

/** 判断顶层导航是否仍在网易云站点内 */
const isNeteaseUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "music.163.com" || host.endsWith(".music.163.com");
  } catch {
    return false;
  }
};

/** 仅将 HTTP(S) 外链交给系统浏览器 */
const openExternalSafe = (url: string): void => {
  try {
    if (/^https?:$/i.test(new URL(url).protocol)) void shell.openExternal(url);
  } catch {
    coreLog.warn("[podcast-manager] blocked invalid navigation:", url);
  }
};

/** 将应用登录态同步到播客管理专属会话 */
const syncNeteaseCookies = async (): Promise<Electron.Session> => {
  const cookies = getNeteaseCookies();
  if (!cookies.MUSIC_U) throw new Error("netease login required");

  const ses = session.fromPartition(MANAGER_PARTITION);
  ses.setUserAgent(NETEASE_WEB_USER_AGENT);
  await ses.clearStorageData({ storages: ["cookies"] });
  await Promise.all(
    WEB_COOKIE_KEYS.flatMap((name) => {
      const value = cookies[name];
      if (!value) return [];
      return [
        ses.cookies.set({
          url: NETEASE_ORIGIN,
          name,
          value,
          domain: ".music.163.com",
          path: "/",
          secure: true,
        }),
      ];
    }),
  );
  return ses;
};

/** 打开带应用网易云登录态的播客管理页 */
export const openNeteasePodcastManager = async (): Promise<void> => {
  if (managerWindow && !managerWindow.isDestroyed()) {
    if (managerWindow.isMinimized()) managerWindow.restore();
    managerWindow.show();
    managerWindow.focus();
    return;
  }

  const ses = await syncNeteaseCookies();
  const parent = getMainWindow() ?? undefined;
  const win = new BrowserWindow({
    parent,
    modal: false,
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    center: true,
    title: "网易云音乐 · 管理播客",
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      session: ses,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  managerWindow = win;
  win.webContents.setUserAgent(NETEASE_WEB_USER_AGENT);
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (managerWindow === win) managerWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isNeteaseUrl(url)) {
      void win.loadURL(url, { userAgent: NETEASE_WEB_USER_AGENT });
    } else {
      openExternalSafe(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isNeteaseUrl(url)) return;
    event.preventDefault();
    openExternalSafe(url);
  });

  try {
    await win.loadURL(PODCAST_MANAGER_URL, { userAgent: NETEASE_WEB_USER_AGENT });
  } catch (err) {
    if (!win.isDestroyed()) win.destroy();
    coreLog.warn("[podcast-manager] load failed:", err);
    throw err;
  }
};
