import localforage from "localforage";
import type { Album, Playlist, Track } from "@shared/types/player";
import type { Podcast } from "@/types/podcast";
import {
  fetchRecentAlbums,
  fetchRecentPlaylists,
  fetchRecentPodcasts,
  fetchRecentSongs,
  fetchRecentVoices,
  removeRecentEntries,
  type NeteaseRecentEntry,
  type NeteaseRecentKind,
} from "@/apis/history/netease";

const db = localforage.createInstance({ name: "splayer", storeName: "history" });
const HISTORY_KEY = "entries";

/** 历史条数上限，超出按时间倒序裁掉尾部 */
const MAX_HISTORY = 500;

/** 单条播放历史 */
export interface HistoryEntry {
  track: Track;
  /** 最近一次播放时间（unix ms） */
  playedAt: number;
}

/** 同源同 id 视为同一首 */
const keyOf = (track: Track): string => `${track.source}:${track.id}`;

export const useHistoryStore = defineStore("history", () => {
  /** 倒序：最近播放在前 */
  const entries = shallowRef<HistoryEntry[]>([]);
  /** 首次读盘，并发调用复用同一个 */
  let loadPromise: Promise<void> | null = null;
  const recentSongs = shallowRef<NeteaseRecentEntry<Track>[]>([]);
  const recentVoices = shallowRef<NeteaseRecentEntry<Track>[]>([]);
  const recentPlaylists = shallowRef<NeteaseRecentEntry<Playlist>[]>([]);
  const recentAlbums = shallowRef<NeteaseRecentEntry<Album>[]>([]);
  const recentPodcasts = shallowRef<NeteaseRecentEntry<Podcast>[]>([]);
  const remoteLoading = ref<NeteaseRecentKind | null>(null);
  const remoteLoaded = reactive<Record<NeteaseRecentKind, boolean>>({
    song: false,
    voice: false,
    playlist: false,
    album: false,
    podcast: false,
  });
  const remoteErrors = reactive<Record<NeteaseRecentKind, string>>({
    song: "",
    voice: "",
    playlist: "",
    album: "",
    podcast: "",
  });

  /** 持久化 */
  const persist = (): void => {
    void db.setItem(HISTORY_KEY, toRaw(entries.value)).catch(() => {});
  };

  /** 启动时读一次盘，之后内存为真值源 */
  const load = (): Promise<void> => {
    if (!loadPromise) {
      loadPromise = db
        .getItem<HistoryEntry[]>(HISTORY_KEY)
        .then((cached) => {
          if (Array.isArray(cached)) entries.value = cached;
        })
        .catch(() => {});
    }
    return loadPromise;
  };

  /**
   * 记录一次播放：同源同 id 去重后置顶
   * @param track 当前播放曲目
   */
  const record = async (track: Track): Promise<void> => {
    if (!track?.id) return;
    await load();
    const key = keyOf(track);
    const filtered = entries.value.filter((item) => keyOf(item.track) !== key);
    entries.value = [{ track, playedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
    persist();
  };

  /**
   * 移除单条历史
   * @param track 要删除的曲目
   */
  const remove = (track: Track): void => {
    const key = keyOf(track);
    const next = entries.value.filter((entry) => keyOf(entry.track) !== key);
    if (next.length === entries.value.length) return;
    entries.value = next;
    persist();
  };

  /** 清空全部历史 */
  const clear = (): void => {
    entries.value = [];
    persist();
  };

  const getRemoteEntries = (
    kind: NeteaseRecentKind,
  ): NeteaseRecentEntry<Track | Playlist | Album | Podcast>[] => {
    if (kind === "song") return recentSongs.value;
    if (kind === "voice") return recentVoices.value;
    if (kind === "playlist") return recentPlaylists.value;
    if (kind === "album") return recentAlbums.value;
    return recentPodcasts.value;
  };

  /**
   * 加载指定类型的多端最近播放
   * @param kind - 最近播放资源类型
   * @param force - 是否忽略本次会话的已加载状态
   */
  const loadRemote = async (kind: NeteaseRecentKind, force = false): Promise<void> => {
    if (!force && remoteLoaded[kind]) return;
    remoteLoading.value = kind;
    remoteErrors[kind] = "";
    try {
      if (kind === "song") recentSongs.value = await fetchRecentSongs();
      else if (kind === "voice") recentVoices.value = await fetchRecentVoices();
      else if (kind === "playlist") recentPlaylists.value = await fetchRecentPlaylists();
      else if (kind === "album") recentAlbums.value = await fetchRecentAlbums();
      else recentPodcasts.value = await fetchRecentPodcasts();
      remoteLoaded[kind] = true;
    } catch (error) {
      remoteErrors[kind] = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (remoteLoading.value === kind) remoteLoading.value = null;
    }
  };

  /**
   * 从多端最近播放中同步移除
   * @param kind - 最近播放资源类型
   * @param resourceIds - 要移除的资源 ID
   */
  const removeRemote = async (kind: NeteaseRecentKind, resourceIds: string[]): Promise<void> => {
    const current = getRemoteEntries(kind);
    await removeRecentEntries(kind, resourceIds, current);
    const removed = new Set(resourceIds);
    if (kind === "song") {
      recentSongs.value = recentSongs.value.filter((entry) => !removed.has(entry.resourceId));
    } else if (kind === "voice") {
      recentVoices.value = recentVoices.value.filter((entry) => !removed.has(entry.resourceId));
    } else if (kind === "playlist") {
      recentPlaylists.value = recentPlaylists.value.filter(
        (entry) => !removed.has(entry.resourceId),
      );
    } else if (kind === "album") {
      recentAlbums.value = recentAlbums.value.filter((entry) => !removed.has(entry.resourceId));
    } else {
      recentPodcasts.value = recentPodcasts.value.filter((entry) => !removed.has(entry.resourceId));
    }
  };

  /** 批量移除本地播放历史 */
  const removeLocal = (tracks: Track[]): void => {
    if (tracks.length === 0) return;
    const removed = new Set(tracks.map(keyOf));
    entries.value = entries.value.filter((entry) => !removed.has(keyOf(entry.track)));
    persist();
  };

  /** 按时间倒序的扁平曲目列表 */
  const tracks = computed<Track[]>(() => entries.value.map((entry) => entry.track));

  return {
    entries,
    tracks,
    load,
    record,
    remove,
    clear,
    recentSongs,
    recentVoices,
    recentPlaylists,
    recentAlbums,
    recentPodcasts,
    remoteLoading,
    remoteLoaded,
    remoteErrors,
    getRemoteEntries,
    loadRemote,
    removeRemote,
    removeLocal,
  };
});
