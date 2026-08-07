import type { Track } from "@shared/types/player";
import type { FollowPost } from "./follow";

/** 歌词搜索结果 */
export interface LyricSearchItem {
  track: Track;
  lyrics: string[];
}

/** 用户搜索结果 */
export interface UserSearchItem {
  id: number;
  name: string;
  avatar?: string;
  signature?: string;
  followed: boolean;
  mutual: boolean;
}

/** 搜索分页上下文 */
export interface SearchPageContext {
  cursor?: string;
  sessionId?: string;
  searchUuid?: string;
  currentUserId?: number;
}

/** 笔记搜索结果 */
export type NoteSearchItem = FollowPost;
