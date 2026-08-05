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
  liked?: boolean;
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

/** 评论写操作的共同参数 */
export interface CommentMutationBase {
  sourceId: string;
  target: CommentTarget;
}

/** 发布评论参数 */
export interface CommentAddArgs extends CommentMutationBase {
  content: string;
}

/** 回复评论参数 */
export interface CommentReplyArgs extends CommentAddArgs {
  commentId: string;
}

/** 点赞或取消点赞参数 */
export interface CommentLikeArgs extends CommentMutationBase {
  commentId: string;
  liked: boolean;
}

/** 删除评论参数 */
export interface CommentDeleteArgs extends CommentMutationBase {
  commentId: string;
}

/** 评论 IPC 响应 */
export type CommentResponse = { ok: true; data: MusicCommentPage } | { ok: false; error: string };

/** 评论写操作 IPC 响应 */
export type CommentMutationResponse =
  | { ok: true; data?: MusicCommentItem }
  | { ok: false; error: string };

export type MusicCommentQuery = CommentQuery;
export type MusicCommentResponse = CommentResponse;

/** 渲染端评论 API */
export interface CommentsApi {
  sources: () => Promise<CommentSource[]>;
  get: (args: CommentQuery) => Promise<CommentResponse>;
  add: (args: CommentAddArgs) => Promise<CommentMutationResponse>;
  reply: (args: CommentReplyArgs) => Promise<CommentMutationResponse>;
  like: (args: CommentLikeArgs) => Promise<CommentMutationResponse>;
  delete: (args: CommentDeleteArgs) => Promise<CommentMutationResponse>;
}
