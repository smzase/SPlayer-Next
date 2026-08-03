import { netease as neteaseApi } from "@/apis/netease";
import type {
  ActivityMessage,
  MessagePage,
  MessageUnreadCounts,
  PrivateChatMessage,
  PrivateMessageThread,
} from "@/types/message";
import {
  normalizeActivityMessages,
  normalizePrivateHistory,
  normalizePrivateThreads,
  normalizeUnreadCounts,
} from "@/utils/format/netease-message";

export const MESSAGE_PAGE_SIZE = 30;

/** 获取四类消息未读数量 */
export const fetchMessageUnreadCounts = async (): Promise<MessageUnreadCounts> =>
  normalizeUnreadCounts(await neteaseApi.pl_count());

/**
 * 获取私信会话
 * @param currentUserId - 当前登录用户 ID
 * @param offset - 分页偏移
 * @param limit - 每页数量
 */
export const fetchPrivateThreads = async (
  currentUserId: number,
  offset = 0,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage<PrivateMessageThread>> =>
  normalizePrivateThreads(
    await neteaseApi.msg_private({ offset, limit, timestamp: Date.now() }),
    currentUserId,
  );

/**
 * 获取与指定用户的私信历史
 * @param userId - 对方用户 ID
 * @param currentUserId - 当前登录用户 ID
 * @param before - 上一页最早消息时间
 * @param limit - 每页数量
 */
export const fetchPrivateHistory = async (
  userId: number,
  currentUserId: number,
  before = 0,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage<PrivateChatMessage>> =>
  normalizePrivateHistory(
    await neteaseApi.msg_private_history({
      uid: userId,
      before,
      limit,
      timestamp: Date.now(),
    }),
    currentUserId,
  );

/**
 * 获取回复当前用户的评论
 * @param userId - 当前登录用户 ID
 * @param before - 时间游标
 * @param limit - 每页数量
 */
export const fetchCommentMessages = async (
  userId: number,
  before = -1,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage<ActivityMessage>> =>
  normalizeActivityMessages(
    await neteaseApi.msg_comments({ uid: userId, before, limit, timestamp: Date.now() }),
    "comment",
  );

/**
 * 获取提及当前用户的消息
 * @param offset - 分页偏移
 * @param limit - 每页数量
 */
export const fetchMentionMessages = async (
  offset = 0,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage<ActivityMessage>> =>
  normalizeActivityMessages(
    await neteaseApi.msg_forwards({ offset, limit, timestamp: Date.now() }),
    "mention",
  );

/**
 * 获取点赞、歌单收藏等通知
 * @param lasttime - 时间游标
 * @param limit - 每页数量
 */
export const fetchNoticeMessages = async (
  lasttime = -1,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage<ActivityMessage>> =>
  normalizeActivityMessages(
    await neteaseApi.msg_notices({ lasttime, limit, timestamp: Date.now() }),
    "notice",
  );

/**
 * 发送文本私信
 * @param userId - 接收用户 ID
 * @param text - 私信正文
 */
export const sendPrivateText = async (userId: number, text: string): Promise<void> => {
  await neteaseApi.send_text({ user_ids: userId, msg: text, timestamp: Date.now() });
};

/** 私信图片上传参数 */
export interface PrivateImageUpload {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

/**
 * 上传并发送图片私信
 * @param userId - 接收用户 ID
 * @param image - 图片字节与尺寸
 */
export const sendPrivateImage = async (
  userId: number,
  image: PrivateImageUpload,
): Promise<void> => {
  await neteaseApi.send_image({
    user_ids: userId,
    name: image.name,
    mime_type: image.mimeType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    timestamp: Date.now(),
  });
};

/**
 * 撤回已发送的私信
 * @param messageId - 私信 ID
 */
export const revokePrivateMessage = async (messageId: string): Promise<void> => {
  await neteaseApi.msg_private_revoke({ id: messageId, timestamp: Date.now() });
};

/**
 * 读取全部消息分类，让网易云同步清除服务器未读状态
 * @param userId - 当前登录用户 ID
 */
export const readAllMessageCategories = async (userId: number): Promise<void> => {
  const tasks = [
    neteaseApi.msg_private({ limit: MESSAGE_PAGE_SIZE, offset: 0, timestamp: Date.now() }),
    neteaseApi.msg_comments({
      uid: userId,
      limit: MESSAGE_PAGE_SIZE,
      before: -1,
      timestamp: Date.now(),
    }),
    neteaseApi.msg_forwards({ limit: MESSAGE_PAGE_SIZE, offset: 0, timestamp: Date.now() }),
    neteaseApi.msg_notices({ limit: MESSAGE_PAGE_SIZE, lasttime: -1, timestamp: Date.now() }),
  ];
  const results = await Promise.allSettled(tasks);
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected?.status === "rejected") throw rejected.reason;
};
