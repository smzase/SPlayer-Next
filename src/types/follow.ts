/** 关注动态中的用户摘要 */
export interface FollowUser {
  id: number;
  name: string;
  avatar?: string;
}

/** 音乐笔记可关联的资源类型 */
export type FollowResourceKind = "song" | "artist" | "album" | "playlist" | "podcast";

/** 音乐笔记中的资源卡片 */
export interface FollowResource {
  kind: FollowResourceKind;
  id: string;
  title: string;
  subtitle?: string;
  cover?: string;
}

/** 音乐笔记中的图片 */
export interface FollowImage {
  url: string;
  width?: number;
  height?: number;
}

/** 关注页中的单条音乐笔记 */
export interface FollowPost {
  id: string;
  threadId: string;
  user: FollowUser;
  createdAt: number;
  text: string;
  images: FollowImage[];
  resource?: FollowResource;
  liked: boolean;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  own: boolean;
}

/** 动态评论 */
export interface FollowComment {
  id: string;
  user: FollowUser;
  text: string;
  createdAt: number;
  liked: boolean;
  likeCount: number;
  replyTo?: {
    userId?: number;
    userName: string;
    text: string;
  };
}

/** 关注动态分页 */
export interface FollowFeedPage {
  items: FollowPost[];
  cursor: number;
  more: boolean;
}

/** 动态评论分页 */
export interface FollowCommentPage {
  items: FollowComment[];
  more: boolean;
}

/** 待上传的笔记图片 */
export interface FollowUploadImage {
  file: File;
  previewUrl: string;
}

/** 网易云动态图片信息 */
export type FollowUploadedImage = Record<string, unknown>;
