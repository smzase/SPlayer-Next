import { sendToMain } from "@main/utils/broadcast";
import { isWin } from "@main/utils/config";
import { reapplyWindowsVolume } from "@main/services/windowsVolumeSync";
import { playerLog } from "@main/utils/logger";
import { evaluateDeviceChange, recoveryRetryDelay } from "./devicePolicy";

type AudioEngineModule = typeof import("@splayer/audio-engine");
type PlayerInstance = InstanceType<AudioEngineModule["AudioPlayer"]>;

const DEVICE_EVENT_DEBOUNCE_MS = 200;

/** WASAPI 的输出流自带默认设备切换通知，见 `evaluateDeviceChange` */
const STREAM_REPORTS_DEFAULT_CHANGE = isWin;

let activePlayer: PlayerInstance | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let lastDefaultDevice: string | null | undefined;
let reinitPromise: Promise<void> | null = null;
let pendingReinitPlayer: PlayerInstance | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let pauseOnDeviceSwitch = false;

/** 设置默认输出设备切换前是否立即暂停 */
export const setPauseOnDeviceSwitch = (enabled: boolean): void => {
  pauseOnDeviceSwitch = enabled;
};

/** 取消尚未开始的恢复重试；正在执行的原生重建由新的 load token / 输出代次接管。 */
export const cancelPendingReinit = (): void => {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  pendingReinitPlayer = null;
};

/** 执行一次恢复；失败时按固定次数和退避间隔重新调度。 */
const runReinit = (player: PlayerInstance, attempt: number): void => {
  reinitPromise = player
    .reinitOutput()
    .then(() => {
      reapplyWindowsVolume();
      playerLog.info("音频输出已重建");
    })
    .catch((error) => {
      const nextAttempt = attempt + 1;
      const delay = recoveryRetryDelay(nextAttempt);
      if (delay === null || activePlayer !== player) {
        playerLog.warn("音频输出恢复已耗尽重试次数:", error);
        return;
      }
      playerLog.warn(`音频输出重建失败，将在 ${delay}ms 后重试:`, error);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        pendingReinitPlayer = null;
        if (activePlayer === player) runReinit(player, nextAttempt);
      }, delay);
    })
    .finally(() => {
      reinitPromise = null;
      if (retryTimer !== null) return;
      const pendingPlayer = pendingReinitPlayer;
      pendingReinitPlayer = null;
      if (pendingPlayer !== null && activePlayer === pendingPlayer) requestReinit(pendingPlayer);
    });
};

/** 串行重建音频输出，合并重建期间到达的设备变化 / 输出流错误 */
export const requestReinit = (player: PlayerInstance): void => {
  // 暂停放在重建入口而非默认设备变化分支：Linux 的 cpal PipeWire 后端默认设备名恒为哨兵值
  // default_output，比较设备名判断不出切换，那里只有输出流错误能反映输出已经易主
  // ponytail: 若要区分「主动切换」与「被动断连」，需把各后端已有的精确信号透传进 DeviceChangedCallback
  if (pauseOnDeviceSwitch) player.pauseImmediately();
  if (reinitPromise !== null || retryTimer !== null) {
    pendingReinitPlayer = player;
    return;
  }
  const initialDelay = recoveryRetryDelay(0) ?? 0;
  if (initialDelay > 0) {
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (activePlayer === player) runReinit(player, 0);
    }, initialDelay);
  } else {
    runReinit(player, 0);
  }
};

/** 处理一次设备变化信号 */
const handleDeviceChange = (notifyListChange: boolean): void => {
  const player = activePlayer;
  if (player === null) return;

  try {
    const currentDefault = player.getDefaultDeviceName() ?? null;
    if (lastDefaultDevice === undefined) {
      lastDefaultDevice = currentDefault;
      if (notifyListChange) {
        sendToMain("player:event", {
          type: "deviceChanged",
          data: { defaultDevice: currentDefault },
        });
      }
      return;
    }

    const previousDefault = lastDefaultDevice;
    const decision = evaluateDeviceChange(
      previousDefault,
      currentDefault,
      player.getSelectedDeviceName() ?? null,
      STREAM_REPORTS_DEFAULT_CHANGE,
    );
    lastDefaultDevice = currentDefault;

    if (decision.defaultChanged) {
      playerLog.info(`默认音频设备变化: ${previousDefault} → ${currentDefault}`);
    }
    if (notifyListChange || decision.defaultChanged) {
      sendToMain("player:event", {
        type: "deviceChanged",
        data: { defaultDevice: currentDefault },
      });
    }
    if (decision.shouldReinit) requestReinit(player);
  } catch (error) {
    playerLog.warn("检查音频设备变化失败:", error);
  }
};

/** 合并 Windows 在一次插拔过程中连续发出的设备事件 */
const scheduleDeviceChange = (): void => {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    handleDeviceChange(true);
  }, DEVICE_EVENT_DEBOUNCE_MS);
};

/** 启动原生音频设备监听；不支持的后端依赖输出流错误和停滞检测恢复。 */
export const startDeviceMonitoring = (player: PlayerInstance): void => {
  stopDeviceMonitoring();
  activePlayer = player;

  try {
    lastDefaultDevice = player.getDefaultDeviceName() ?? null;
  } catch (error) {
    lastDefaultDevice = undefined;
    playerLog.warn("读取默认音频设备失败:", error);
  }

  if (player.supportsDeviceWatcher()) {
    try {
      player.onDeviceChange(scheduleDeviceChange);
      playerLog.info("已启用原生音频设备事件监听");
      return;
    } catch (error) {
      playerLog.warn("原生音频设备监听启动失败，将依赖输出流错误恢复:", error);
    }
  }
};

/** 停止音频设备监听并清理待处理事件 */
export const stopDeviceMonitoring = (): void => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activePlayer !== null) {
    try {
      activePlayer.stopDeviceWatcher();
    } catch (error) {
      playerLog.warn("停止原生音频设备监听失败:", error);
    }
  }

  activePlayer = null;
  lastDefaultDevice = undefined;
  cancelPendingReinit();
};
