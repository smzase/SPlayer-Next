import { wsBroadcast } from "@main/server/broadcast";
import { getPlayer, onPlayerCreated } from "@main/services/engine";
import * as mediaService from "@main/services/media";
import { store } from "@main/store";
import { sendToMain } from "@main/utils/broadcast";
import { isWin } from "@main/utils/config";
import { playerLog } from "@main/utils/logger";

type AudioEngineModule = typeof import("@splayer/audio-engine");
type PlayerInstance = InstanceType<AudioEngineModule["AudioPlayer"]>;

const POLL_INTERVAL_MS = 500;
const SESSION_RELEASE_DELAY_MS = 100;
const VOLUME_EPSILON = 0.002;

let initialized = false;
let enabled = false;
let logicalVolume = 1;
let sessionBound = false;
let pollingTimer: NodeJS.Timeout | null = null;
let releaseTimer: NodeJS.Timeout | null = null;
let releasePlayer: PlayerInstance | null = null;

/** 将音量限制在播放器支持的范围内 */
const clampVolume = (volume: number): number => Math.max(0, Math.min(1, volume));

const supportsSessionVolume = (player: PlayerInstance): boolean =>
  typeof player.getWindowsSessionVolume === "function" &&
  typeof player.setWindowsSessionVolume === "function" &&
  typeof player.setWindowsSessionMuted === "function";

const getSessionVolume = (player: PlayerInstance): number | null => {
  if (!supportsSessionVolume(player)) return null;
  return player.getWindowsSessionVolume();
};

const setSessionVolume = (player: PlayerInstance, volume: number): boolean =>
  supportsSessionVolume(player) && player.setWindowsSessionVolume(volume);

const setSessionMuted = (player: PlayerInstance, muted: boolean): boolean =>
  supportsSessionVolume(player) && player.setWindowsSessionMuted(muted);

const cancelSessionRelease = (unmute: boolean): void => {
  if (releaseTimer !== null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (unmute && releasePlayer !== null) setSessionMuted(releasePlayer, false);
  releasePlayer = null;
};

/** 向界面、外部 API 和系统媒体控件同步逻辑音量 */
const publishVolume = (volume: number, syncSystemMedia = true): void => {
  if (syncSystemMedia) mediaService.setVolume(volume);
  const event = { type: "volume" as const, data: { volume } };
  sendToMain("player:event", event);
  wsBroadcast(event);
};

/** 将逻辑音量交给 Windows 音频会话 */
const bindSession = (player: PlayerInstance): boolean => {
  cancelSessionRelease(true);
  if (!setSessionVolume(player, logicalVolume)) return false;
  setSessionMuted(player, false);
  if (!sessionBound) player.setVolume(1);
  sessionBound = true;
  return true;
};

const pollSessionVolume = (): void => {
  if (!enabled) return;
  const player = getPlayer();
  if (!sessionBound) {
    bindSession(player);
    return;
  }
  const volume = getSessionVolume(player);
  if (volume == null || Math.abs(volume - logicalVolume) < VOLUME_EPSILON) return;
  logicalVolume = clampVolume(volume);
  publishVolume(logicalVolume);
};

const startPolling = (): void => {
  if (pollingTimer !== null) return;
  pollingTimer = setInterval(pollSessionVolume, POLL_INTERVAL_MS);
};

const stopPolling = (): void => {
  if (pollingTimer === null) return;
  clearInterval(pollingTimer);
  pollingTimer = null;
};

/**
 * 处理播放器实例创建或重建
 * @param player - 新的原生播放器实例
 */
const handlePlayerCreated = (player: PlayerInstance): void => {
  cancelSessionRelease(true);
  sessionBound = false;
  if (!enabled) return;
  player.setVolume(logicalVolume);
  bindSession(player);
};

/** 初始化 Windows 音量合成器同步服务 */
export const initWindowsVolumeSync = (): void => {
  if (initialized) return;
  initialized = true;
  onPlayerCreated(handlePlayerCreated);
  if (isWin && store.get("player.syncWindowsVolumeMixer")) {
    setWindowsVolumeSyncEnabled(true);
  }
};

/**
 * 启用或关闭 Windows 音量合成器同步
 * @param nextEnabled - 是否启用同步
 */
export const setWindowsVolumeSyncEnabled = (nextEnabled: boolean): void => {
  const shouldEnable = isWin && nextEnabled;
  if (enabled === shouldEnable) return;

  const player = getPlayer();
  if (shouldEnable) {
    cancelSessionRelease(true);
    logicalVolume = clampVolume(player.getVolume());
    sessionBound = false;
    if (!supportsSessionVolume(player)) {
      player.setVolume(logicalVolume);
      playerLog.error("当前 audio-engine 不支持 Windows 音量合成器同步，请重新构建原生模块");
      return;
    }
    enabled = true;
    if (!bindSession(player)) player.setVolume(logicalVolume);
    startPolling();
    return;
  }

  stopPolling();
  enabled = false;
  const sessionVolume = sessionBound ? getSessionVolume(player) : null;
  if (sessionVolume != null) logicalVolume = clampVolume(sessionVolume);
  const muted = sessionBound && setSessionMuted(player, true);
  player.setVolume(logicalVolume);
  setSessionVolume(player, 1);
  if (muted) {
    releasePlayer = player;
    releaseTimer = setTimeout(() => {
      if (releasePlayer !== null) setSessionMuted(releasePlayer, false);
      releasePlayer = null;
      releaseTimer = null;
    }, SESSION_RELEASE_DELAY_MS);
    releaseTimer.unref();
  }
  sessionBound = false;
  publishVolume(logicalVolume);
};

/**
 * 设置播放器逻辑音量
 * @param volume - 音量值，范围 0 到 1
 * @param syncSystemMedia - 是否回写系统媒体控件
 */
export const setPlayerVolume = (volume: number, syncSystemMedia = true): void => {
  logicalVolume = clampVolume(volume);
  const player = getPlayer();
  if (enabled) {
    if (!bindSession(player)) {
      sessionBound = false;
      player.setVolume(logicalVolume);
    }
  } else {
    player.setVolume(logicalVolume);
  }
  publishVolume(logicalVolume, syncSystemMedia);
};

/** 获取播放器当前逻辑音量 */
export const getPlayerVolume = (): number =>
  enabled ? logicalVolume : clampVolume(getPlayer().getVolume());

/** 在输出设备重建后把逻辑音量应用到新的音频会话 */
export const reapplyWindowsVolume = (): void => {
  if (!enabled) return;
  cancelSessionRelease(true);
  sessionBound = false;
  const player = getPlayer();
  player.setVolume(logicalVolume);
  bindSession(player);
};

/** 清理 Windows 音量合成器同步服务 */
export const disposeWindowsVolumeSync = (): void => {
  stopPolling();
  cancelSessionRelease(true);
  sessionBound = false;
};
