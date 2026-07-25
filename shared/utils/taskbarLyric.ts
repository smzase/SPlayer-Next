import type { RepeatMode, ShuffleMode } from "@shared/types/player";
import type { TaskbarPlayMode, TaskbarPlayModeState } from "@shared/types/taskbarLyric";

/** 任务栏播放模式循环顺序 */
export const TASKBAR_PLAY_MODE_CYCLE: readonly TaskbarPlayMode[] = [
  "repeat-list",
  "repeat-one",
  "shuffle",
  "sequential",
];

/**
 * 将播放器底层状态归一为任务栏四态模式
 * @param repeatMode - 循环状态
 * @param shuffleMode - 随机状态
 * @param sequential - 是否启用任务栏独有的顺序播放
 */
export const resolveTaskbarPlayMode = (
  repeatMode: RepeatMode,
  shuffleMode: ShuffleMode,
  sequential = false,
): TaskbarPlayMode => {
  if (shuffleMode === "on") return "shuffle";
  if (repeatMode === "one") return "repeat-one";
  if (sequential) return "sequential";
  return "repeat-list";
};

/**
 * 获取统一播放模式对应的播放器状态
 * @param mode - 任务栏统一播放模式
 */
export const resolveTaskbarPlayModeState = (mode: TaskbarPlayMode): TaskbarPlayModeState => {
  switch (mode) {
    case "repeat-one":
      return { repeatMode: "one", shuffleMode: "off", sequential: false };
    case "shuffle":
      return { repeatMode: "list", shuffleMode: "on", sequential: false };
    case "sequential":
      return { repeatMode: "list", shuffleMode: "off", sequential: true };
    case "repeat-list":
      return { repeatMode: "list", shuffleMode: "off", sequential: false };
  }
};

/**
 * 获取任务栏按钮点击后的下一个模式
 * @param mode - 当前统一播放模式
 */
export const nextTaskbarPlayMode = (mode: TaskbarPlayMode): TaskbarPlayMode => {
  const index = TASKBAR_PLAY_MODE_CYCLE.indexOf(mode);
  return TASKBAR_PLAY_MODE_CYCLE[(index + 1) % TASKBAR_PLAY_MODE_CYCLE.length];
};
