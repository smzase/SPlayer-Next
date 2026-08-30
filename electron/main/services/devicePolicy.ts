export interface DeviceChangeDecision {
  defaultChanged: boolean;
  shouldReinit: boolean;
}

const RECOVERY_RETRY_DELAYS_MS = [100, 300, 1000] as const;

/** 返回指定恢复尝试前的等待时间；超过最大次数时不再重试。 */
export const recoveryRetryDelay = (attempt: number): number | null =>
  RECOVERY_RETRY_DELAYS_MS[attempt] ?? null;

/**
 * 根据默认设备和用户选择决定是否重建音频输出
 * @param streamReportsDefaultChange - 输出流自身是否会上报默认设备切换。cpal 的 WASAPI 后端
 *   在跟随默认设备的流上注册了自己的 IMMNotificationClient，切换时通过错误回调发出
 *   StreamInvalidated（即 outputFailed），覆盖范围与这里的判断完全重合且更及时；两处都触发
 *   只会把一次插拔放大成多轮重建。其它后端没有这个通知，仍靠设备监听兜底
 */
export const evaluateDeviceChange = (
  previousDefault: string | null,
  currentDefault: string | null,
  selectedDevice: string | null,
  streamReportsDefaultChange: boolean,
): DeviceChangeDecision => {
  const defaultChanged = previousDefault !== currentDefault;
  return {
    defaultChanged,
    shouldReinit:
      !streamReportsDefaultChange &&
      defaultChanged &&
      currentDefault !== null &&
      selectedDevice === null,
  };
};
