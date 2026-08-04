import type { Playlist } from "@shared/types/player";
import type { Podcast } from "@/types/podcast";

/** 用户主页资料 */
export interface UserPageProfile {
  userId: number;
  nickname: string;
  avatarUrl?: string;
  artistId?: string;
  signature?: string;
  gender: number;
  birthday?: number;
  province?: number;
  city?: number;
  follows: number;
  followeds: number;
  eventCount: number;
  playlistCount: number;
  listenSongs: number;
  level?: number;
  vipType?: number;
  followed: boolean;
  followedBy: boolean;
  mutual: boolean;
  blacklisted: boolean;
}

export type UserResourceAccess = "available" | "private" | "unavailable";

/** 用户主页资源 */
export interface UserPageResources {
  createdPlaylists: Playlist[];
  collectedPlaylists: Playlist[];
  createdPodcasts: Podcast[];
  collectedPodcasts: Podcast[];
  playlistAccess: UserResourceAccess;
  createdPodcastsAccess: UserResourceAccess;
  collectedPodcastsAccess: UserResourceAccess;
}

export type UserConnectionKind = "all" | "artist" | "user";

/** 关注或粉丝列表条目 */
export interface UserConnection {
  id: number;
  name: string;
  avatar?: string;
  signature?: string;
  kind: "artist" | "user";
  followed: boolean;
  mutual: boolean;
}

/** 关注或粉丝列表分页 */
export interface UserConnectionPage {
  items: UserConnection[];
  nextCursor?: number;
  more: boolean;
}

/** 可编辑的个人资料 */
export interface UserProfileUpdate {
  nickname: string;
  signature: string;
  gender: number;
  birthday: number;
  province: number;
  city: number;
}
