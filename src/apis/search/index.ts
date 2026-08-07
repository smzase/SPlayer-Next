/**
 * 在线平台搜索分发
 * 对外暴露歌曲、专辑、歌手、歌单、播客与声音搜索
 */

import type { Track } from "@shared/types/player";
import type { CoverItem } from "@/types/artist";
import type { Platform } from "@shared/types/platform";
import type {
  LyricSearchItem,
  NoteSearchItem,
  SearchPageContext,
  UserSearchItem,
} from "@/types/search";
import * as netease from "./netease";
import * as qqmusic from "./qqmusic";
import * as kugou from "./kugou";

/** 搜索结果通用 */
export interface SearchResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
  sessionId?: string;
  searchUuid?: string;
}

const unsupported = (platform: Platform, category: string): never => {
  throw new Error(`Search not yet supported: ${platform}.${category}`);
};

/** 搜索单曲 */
export const searchSongs = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<Track>> => {
  if (platform === "netease") return netease.songs(keyword, offset, limit);
  if (platform === "qqmusic") return qqmusic.songs(keyword, offset, limit);
  if (platform === "kugou") return kugou.songs(keyword, offset, limit);
  return unsupported(platform, "songs");
};

/** 搜索专辑 */
export const searchAlbums = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<CoverItem>> => {
  if (platform === "netease") return netease.albums(keyword, offset, limit);
  if (platform === "qqmusic") return qqmusic.albums(keyword, offset, limit);
  if (platform === "kugou") return kugou.albums(keyword, offset, limit);
  return unsupported(platform, "albums");
};

/** 搜索歌手 */
export const searchArtists = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<CoverItem>> => {
  if (platform === "netease") return netease.artists(keyword, offset, limit);
  if (platform === "qqmusic") return qqmusic.artists(keyword, offset, limit);
  if (platform === "kugou") return kugou.artists(keyword, offset, limit);
  return unsupported(platform, "artists");
};

/** 搜索歌单 */
export const searchPlaylists = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<CoverItem>> => {
  if (platform === "netease") return netease.playlists(keyword, offset, limit);
  if (platform === "qqmusic") return qqmusic.playlists(keyword, offset, limit);
  if (platform === "kugou") return kugou.playlists(keyword, offset, limit);
  return unsupported(platform, "playlists");
};

/** 搜索播客 */
export const searchPodcasts = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<CoverItem>> => {
  if (platform === "netease") return netease.podcasts(keyword, offset, limit);
  return unsupported(platform, "podcasts");
};

/** 搜索声音节目 */
export const searchVoices = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<Track>> => {
  if (platform === "netease") return netease.voices(keyword, offset, limit);
  return unsupported(platform, "voices");
};

/** 搜索歌词 */
export const searchLyrics = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<LyricSearchItem>> => {
  if (platform === "netease") return netease.lyrics(keyword, offset, limit);
  return unsupported(platform, "lyrics");
};

/** 搜索用户 */
export const searchUsers = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchResult<UserSearchItem>> => {
  if (platform === "netease") return netease.users(keyword, offset, limit);
  return unsupported(platform, "users");
};

/** 搜索音乐笔记 */
export const searchNotes = (
  platform: Platform,
  keyword: string,
  offset: number,
  limit: number,
  context?: SearchPageContext,
): Promise<SearchResult<NoteSearchItem>> => {
  if (platform === "netease") return netease.notes(keyword, offset, limit, context);
  return unsupported(platform, "notes");
};
