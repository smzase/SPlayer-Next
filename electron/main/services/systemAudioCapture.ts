import { desktopCapturer, screen, session } from "electron";
import { getMainWindow } from "@main/window";
import { coreLog } from "@main/utils/logger";
import { MAIN_PARTITION } from "@main/utils/protocol";

/** 注册仅供主窗口使用的系统回放音频捕获处理器 */
export const initSystemAudioCapture = (): void => {
  session.fromPartition(MAIN_PARTITION).setDisplayMediaRequestHandler(
    async (request, callback) => {
      const mainWindow = getMainWindow();
      if (
        process.platform !== "win32" ||
        !mainWindow ||
        mainWindow.isDestroyed() ||
        request.frame !== mainWindow.webContents.mainFrame ||
        !request.audioRequested
      ) {
        callback({});
        return;
      }

      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 0, height: 0 },
          fetchWindowIcons: false,
        });
        const display = screen.getDisplayMatching(mainWindow.getBounds());
        const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[0];
        if (!source) {
          callback({});
          return;
        }
        callback({ video: source, audio: "loopback" });
      } catch (error) {
        coreLog.warn("[audio-recognition] 获取系统回放音频失败:", error);
        callback({});
      }
    },
    { useSystemPicker: false },
  );
};

/** 移除系统回放音频捕获处理器 */
export const disposeSystemAudioCapture = (): void => {
  session.fromPartition(MAIN_PARTITION).setDisplayMediaRequestHandler(null);
};
