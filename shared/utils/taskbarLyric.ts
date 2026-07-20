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
 */
export const resolveTaskbarPlayMode = (
  repeatMode: RepeatMode,
  shuffleMode: ShuffleMode,
): TaskbarPlayMode => {
  if (shuffleMode === "on") return "shuffle";
  if (repeatMode === "one") return "repeat-one";
  if (repeatMode === "off") return "sequential";
  return "repeat-list";
};

/**
 * 获取统一播放模式对应的底层状态
 * @param mode - 任务栏统一播放模式
 */
export const resolveTaskbarPlayModeState = (mode: TaskbarPlayMode): TaskbarPlayModeState => {
  switch (mode) {
    case "repeat-one":
      return { repeatMode: "one", shuffleMode: "off" };
    case "shuffle":
      return { repeatMode: "list", shuffleMode: "on" };
    case "sequential":
      return { repeatMode: "off", shuffleMode: "off" };
    case "repeat-list":
      return { repeatMode: "list", shuffleMode: "off" };
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
