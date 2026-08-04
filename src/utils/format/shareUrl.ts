import type { Track } from "@shared/types/player";
import type { Collection } from "@/types/collection";

/**
 * 取在线平台的歌曲分享链接
 * @param track - 当前歌曲，本地/流媒体/不支持平台返回 null
 */
export const getShareUrl = (track: Track | null | undefined): string | null => {
  if (!track?.id) return null;
  switch (track.source) {
    case "netease":
      if (track.extId) return `https://music.163.com/#/dj?id=${track.extId}`;
      return `https://music.163.com/#/song?id=${track.id}`;
    case "qqmusic":
      return `https://y.qq.com/n/ryqq_v2/songDetail/${track.id}`;
    case "kugou":
      return `https://www.kugou.com/mixsong/${track.id}.html`;
    default:
      return null;
  }
};

/**
 * 取得在线平台的歌单、专辑或电台分享链接
 * @param collection - 当前集合，本地、流媒体和云盘集合不提供平台分享链接
 */
export const getCollectionShareUrl = (
  collection: Pick<Collection, "id" | "source" | "type"> | null | undefined,
): string | null => {
  if (!collection?.id) return null;
  if (collection.source === "netease") {
    const path = {
      playlist: "playlist",
      album: "album",
      radio: "djradio",
      cloud: "",
    }[collection.type];
    return path ? `https://music.163.com/#/${path}?id=${collection.id}` : null;
  }
  if (collection.source === "qqmusic") {
    const path = {
      playlist: "playlist",
      album: "albumDetail",
      radio: "",
      cloud: "",
    }[collection.type];
    return path ? `https://y.qq.com/n/ryqq_v2/${path}/${collection.id}` : null;
  }
  return null;
};
