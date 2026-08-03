import type { Track, TrackSource } from "./player";

/** 评论来源类型 */
export type CommentSourceKind = "builtin" | "plugin";

/** 评论分页类型 */
export type CommentTab = "hot" | "new";

/** 评论来源 */
export interface CommentSource {
  id: string;
  name: string;
  kind: CommentSourceKind;
  platform?: "netease";
  pluginId?: string;
  pluginSource?: string;
}

/** 单条歌曲评论 */
export interface MusicCommentItem {
  id: string;
  userId?: string;
  userName: string;
  avatar?: string;
  text: string;
  time?: number;
  location?: string;
  likedCount?: number;
  images?: string[];
  replyTotal?: number;
  reply?: MusicCommentItem[];
  hasMoreReply?: boolean;
}

/** 歌曲评论分页 */
export interface MusicCommentPage {
  list: MusicCommentItem[];
  total: number;
  page: number;
  limit: number;
}

/** 评论目标 */
export type CommentTarget =
  | {
      kind: "song";
      id: string;
      title: string;
      source: TrackSource;
      track: Track;
    }
  | CollectionCommentTarget;

/** 歌单、专辑或电台评论目标 */
export interface CollectionCommentTarget {
  kind: "playlist" | "album" | "radio";
  id: string;
  title: string;
  source: TrackSource;
}

/** 评论查询参数 */
export interface CommentQuery {
  sourceId: string;
  target: CommentTarget;
  type: CommentTab;
  page: number;
  limit: number;
}

/** 评论 IPC 响应 */
export type CommentResponse = { ok: true; data: MusicCommentPage } | { ok: false; error: string };

export type MusicCommentQuery = CommentQuery;
export type MusicCommentResponse = CommentResponse;

/** 渲染端评论 API */
export interface CommentsApi {
  sources: () => Promise<CommentSource[]>;
  get: (args: CommentQuery) => Promise<CommentResponse>;
}
