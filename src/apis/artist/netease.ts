import type { Album, Artist, Track } from "@shared/types/player";
import { netease as neteaseApi } from "@/apis/netease";
import { ensureOk, songsToTracks, toAlbum, toArtist } from "@/utils/format/netease";

/**
 * 拉取歌手：基本资料 + 热门 50 首 + 全部专辑
 * 两次并行请求（artists + artist_album），专辑用 200 的 limit 覆盖绝大多数情况
 * 更多歌曲通过 fetchArtistSongs 触底分页拉
 * @param artistId 歌手 id
 */
export const fetchArtist = async (
  artistId: string,
): Promise<{ artist: Artist; tracks: Track[]; albums: Album[]; userId?: number } | null> => {
  const [profile, albums] = await Promise.all([
    neteaseApi.artists({ id: artistId }),
    neteaseApi.artist_album({ id: artistId, limit: 200 }),
  ]);
  const rawArtist = profile?.artist;
  if (!rawArtist) return null;
  const userId = Number(rawArtist.accountId ?? rawArtist.userId);
  return {
    artist: toArtist(rawArtist),
    tracks: songsToTracks(profile?.hotSongs),
    albums: (albums?.hotAlbums ?? []).map(toAlbum),
    userId: Number.isFinite(userId) && userId > 0 ? userId : undefined,
  };
};

/**
 * 触底加载更多歌手歌曲
 * @param artistId 歌手 id
 * @param offset 偏移（首屏 50 首之后从 50 起）
 * @param limit 单页数量，默认 50
 */
export const fetchArtistSongs = async (
  artistId: string,
  offset: number,
  limit = 50,
): Promise<{ tracks: Track[]; more: boolean }> => {
  const body = await neteaseApi.artist_songs({ id: artistId, offset, limit, order: "hot" });
  return {
    tracks: songsToTracks(body?.songs),
    more: !!body?.more,
  };
};

/**
 * 收藏 / 取消收藏歌手
 * @param id 歌手 id
 * @param subscribe true 收藏，false 取消
 */
export const subscribeArtist = async (id: string, subscribe: boolean): Promise<void> => {
  ensureOk(await neteaseApi.artist_sub({ id, t: subscribe ? 1 : 2 }));
};
