import type { NeteasePlaybackSourceType, Track } from "../types/player";

export interface NeteaseScrobbleTrack {
  id: string;
  sourceId: string;
  sourceType: NeteasePlaybackSourceType;
  title: string;
  artist: string;
  bitrate: number;
  level: string;
  durationSec: number;
}

const asNumericId = (value: string | undefined): string | null =>
  value && /^\d+$/.test(value) ? value : null;

const toBitrate = (track: Track): number => {
  const bitRate = track.quality?.bitRate ?? 320;
  return bitRate > 10000 ? Math.round(bitRate / 1000) : Math.round(bitRate);
};

const toLevel = (track: Track): string => {
  if (track.quality?.codec?.toLowerCase() === "flac") return "lossless";
  if ((track.quality?.bitRate ?? 0) >= 320000) return "exhigh";
  return "higher";
};

/**
 * 从播放曲目生成网易云打卡元数据
 * @param track - 当前播放曲目
 * @param durationMs - 引擎确认后的时长
 * @returns 网易云曲目返回打卡元数据，其余来源返回 null
 */
export const toNeteaseScrobbleTrack = (
  track: Track | null,
  durationMs: number,
): NeteaseScrobbleTrack | null => {
  if (!track || track.source !== "netease") return null;
  const id = asNumericId(track.id);
  if (!id) return null;
  const contextId = asNumericId(track.playbackSource?.id);
  return {
    id,
    sourceId: contextId ?? id,
    sourceType: contextId ? (track.playbackSource?.type ?? "song") : "song",
    title: track.title,
    artist: track.artists.map((artist) => artist.name).join(" / "),
    bitrate: toBitrate(track),
    level: toLevel(track),
    durationSec: Math.round(durationMs / 1000),
  };
};
