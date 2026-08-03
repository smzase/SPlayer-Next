/** 网易云消息分类 */
export type MessageCategory = "private" | "comment" | "mention" | "notice";

/** 私信输入框的发送快捷键 */
export type MessageSendShortcut = "enter" | "ctrlEnter";

/** 消息中的用户摘要 */
export interface MessageUser {
  userId: number;
  nickname: string;
  avatarUrl?: string;
}

/** 私信中的歌曲、专辑或歌单摘要 */
export type MessageResourceKind = "song" | "album" | "playlist";

export interface MessageResource {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  kind?: MessageResourceKind;
  id?: string;
}

/** 私信中的图片内容 */
export interface MessageImage {
  url: string;
  width?: number;
  height?: number;
}

/** 私信会话列表项 */
export interface PrivateMessageThread {
  id: string;
  user: MessageUser;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  lastMessageIsImage?: boolean;
}

/** 私信会话中的单条消息 */
export interface PrivateChatMessage {
  id: string;
  fromUserId: number;
  mine: boolean;
  text: string;
  time: number;
  resource?: MessageResource;
  image?: MessageImage;
}

/** 消息浮窗三分钟内可恢复的页面 */
export interface MessageViewState {
  category: MessageCategory;
  thread?: MessageUser;
  scrollPositions: Record<MessageCategory, number>;
  expiresAt: number;
}

/** 长期保存的私信草稿 */
export interface MessageDraft {
  text: string;
  updatedAt: number;
}

/** 评论、提及或通知的动作类型 */
export type ActivityMessageKind =
  | "commentReply"
  | "mention"
  | "likedComment"
  | "subscribedPlaylist"
  | "notice";

/** 评论、提及或通知列表项 */
export interface ActivityMessage {
  id: string;
  user?: MessageUser;
  kind: ActivityMessageKind;
  text: string;
  detail?: string;
  time: number;
  resource?: MessageResource;
}

/** 消息分页结果 */
export interface MessagePage<T> {
  items: T[];
  more: boolean;
  cursor?: number;
}

/** 四类消息的未读数量 */
export type MessageUnreadCounts = Record<MessageCategory, number>;
