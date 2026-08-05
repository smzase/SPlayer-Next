import { netease as neteaseApi } from "@/apis/netease";
import type {
  FollowComment,
  FollowCommentPage,
  FollowFeedPage,
  FollowPost,
  FollowResource,
  FollowUploadedImage,
  FollowUser,
} from "@/types/follow";
import {
  normalizeFollowComments,
  normalizeFollowFeed,
  normalizeFollowPost,
} from "@/utils/format/netease-event";
import { ensureOk, withPicSize } from "@/utils/format/netease";

export const FOLLOW_PAGE_SIZE = 20;
export const FOLLOW_COMMENT_PAGE_SIZE = 30;

type RawRecord = Record<string, unknown>;

const asRecord = (value: unknown): RawRecord | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;

const toFollowUsers = (values: unknown[]): FollowUser[] =>
  values.flatMap((value) => {
    const user = asRecord(value);
    if (!user) return [];
    const id = Number(user.userId ?? user.id);
    const name = String(user.nickname ?? user.name ?? "").trim();
    if (!Number.isFinite(id) || !name) return [];
    const avatar = withPicSize(String(user.avatarUrl ?? ""), 72);
    return [{ id, name, ...(avatar ? { avatar } : {}) }];
  });

/**
 * 获取已关注用户发布的动态
 * @param currentUserId - 当前登录用户 ID
 * @param cursor - 动态流游标
 * @returns 关注动态分页
 */
export const fetchFollowFeed = async (
  currentUserId: number,
  cursor = -1,
): Promise<FollowFeedPage> =>
  normalizeFollowFeed(
    await neteaseApi.event_feed({
      cursor,
      pagesize: FOLLOW_PAGE_SIZE,
      timestamp: Date.now(),
    }),
    currentUserId,
  );

/**
 * 获取指定用户的历史动态
 * @param userId - 动态发布者 ID
 * @param cursor - 用户动态时间游标
 * @param currentUserId - 当前登录用户 ID
 * @returns 用户动态分页
 */
export const fetchFollowUserHistory = async (
  userId: number,
  cursor = -1,
  currentUserId = 0,
): Promise<FollowFeedPage> =>
  normalizeFollowFeed(
    await neteaseApi.event_user_history({
      uid: userId,
      lasttime: cursor,
      limit: FOLLOW_PAGE_SIZE,
      timestamp: Date.now(),
    }),
    currentUserId,
  );

/**
 * 获取动态详情
 * @param postId - 动态 ID
 * @param userId - 发布者 ID
 * @param currentUserId - 当前登录用户 ID
 * @returns 动态详情
 */
export const fetchFollowPost = async (
  postId: string,
  userId: number,
  currentUserId: number,
): Promise<FollowPost> => {
  const body = await neteaseApi.event_detail({
    id: postId,
    uid: userId,
    timestamp: Date.now(),
  });
  const record = asRecord(body) ?? {};
  const event = record.event ?? asRecord(record.data)?.event;
  const post = normalizeFollowPost(event, currentUserId);
  if (!post) throw new Error("动态内容无效");
  return post;
};

/**
 * 获取动态评论
 * @param threadId - 动态评论线程 ID
 * @param offset - 分页偏移
 * @param limit - 单次获取数量
 * @returns 评论分页
 */
export const fetchFollowComments = async (
  threadId: string,
  offset = 0,
  limit = FOLLOW_COMMENT_PAGE_SIZE,
): Promise<FollowCommentPage> =>
  normalizeFollowComments(
    await neteaseApi.event_comments({
      thread_id: threadId,
      offset,
      limit,
      timestamp: Date.now(),
    }),
  );

/**
 * 点赞或取消点赞动态
 * @param threadId - 动态评论线程 ID
 * @param like - 是否点赞
 */
export const likeFollowPost = async (threadId: string, like: boolean): Promise<void> => {
  ensureOk(
    await neteaseApi.event_like({
      thread_id: threadId,
      like,
      timestamp: Date.now(),
    }),
  );
};

/**
 * 转发动态
 * @param postId - 动态 ID
 * @param userId - 原作者 ID
 * @param text - 转发文字
 */
export const forwardFollowPost = async (
  postId: string,
  userId: number,
  text: string,
): Promise<void> => {
  ensureOk(
    await neteaseApi.event_forward({
      id: postId,
      uid: userId,
      text,
      timestamp: Date.now(),
    }),
  );
};

/**
 * 删除自己的动态
 * @param postId - 动态 ID
 */
export const deleteFollowPost = async (postId: string): Promise<void> => {
  ensureOk(await neteaseApi.event_delete({ id: postId, timestamp: Date.now() }));
};

/**
 * 发布动态评论
 * @param threadId - 动态评论线程 ID
 * @param content - 评论正文
 * @param replyToId - 被回复的评论 ID
 */
export const addFollowComment = async (
  threadId: string,
  content: string,
  replyToId?: string,
): Promise<FollowComment | undefined> => {
  const body = await neteaseApi[replyToId ? "comment_reply" : "comment_add"]<RawRecord>({
    thread_id: threadId,
    ...(replyToId ? { comment_id: replyToId } : {}),
    content,
    timestamp: Date.now(),
  });
  ensureOk(body);
  const raw = body.comment ?? asRecord(body.data)?.comment;
  return raw ? normalizeFollowComments({ comments: [raw] }).items[0] : undefined;
};

/**
 * 删除自己的动态评论
 * @param threadId - 动态评论线程 ID
 * @param commentId - 评论 ID
 */
export const deleteFollowComment = async (threadId: string, commentId: string): Promise<void> => {
  ensureOk(
    await neteaseApi.comment_delete({
      thread_id: threadId,
      comment_id: commentId,
      timestamp: Date.now(),
    }),
  );
};

/**
 * 点赞或取消点赞笔记评论
 * @param threadId - 动态评论线程 ID
 * @param commentId - 评论 ID
 * @param liked - 目标点赞状态
 */
export const likeFollowComment = async (
  threadId: string,
  commentId: string,
  liked: boolean,
): Promise<void> => {
  ensureOk(
    await neteaseApi.comment_like({
      thread_id: threadId,
      comment_id: commentId,
      like: liked,
      timestamp: Date.now(),
    }),
  );
};

const publishType: Record<FollowResource["kind"], string> = {
  song: "song",
  artist: "artist",
  album: "album",
  playlist: "playlist",
  podcast: "djradio",
};

/**
 * 发布音乐笔记
 * @param text - 笔记正文
 * @param resource - 关联音乐资源
 * @param images - 已上传的动态图片信息
 */
export const publishFollowPost = async (
  text: string,
  resource: FollowResource,
  images: FollowUploadedImage[],
): Promise<void> => {
  ensureOk(
    await neteaseApi.event_publish({
      text,
      type: publishType[resource.kind],
      id: resource.id,
      ...(images.length > 0 ? { pics: JSON.stringify(images) } : {}),
      uuid: Date.now(),
      timestamp: Date.now(),
    }),
  );
};

/**
 * 规范化网易云动态图片信息
 * @param raw - 图片合成接口返回的原始信息
 * @returns 发布动态时使用的图片信息
 */
export const normalizeFollowUploadPicInfo = (raw: RawRecord): FollowUploadedImage => {
  const normalized: FollowUploadedImage = {
    ...raw,
    originId: raw.originIdStr,
    squareId: raw.squareIdStr,
    rectangleId: raw.rectangleIdStr,
    pcSquareId: raw.pcSquareIdStr,
    pcRectangleId: raw.pcRectangleIdStr,
  };
  delete normalized.originJpgId;
  return normalized;
};

/**
 * 上传一张音乐笔记图片
 * @param file - 待上传图片
 * @returns 网易云动态图片信息
 */
export const uploadFollowImage = async (file: File): Promise<FollowUploadedImage> => {
  const body = await neteaseApi.event_upload_image<RawRecord>({
    name: file.name,
    mime_type: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
    timestamp: Date.now(),
  });
  ensureOk(body);
  const raw = asRecord(body.picInfo);
  if (!raw) throw new Error("图片信息无效");
  return normalizeFollowUploadPicInfo(raw);
};

/**
 * 获取当前用户关注的人，供 @ 人选择
 * @param userId - 当前用户 ID
 * @returns 已关注用户摘要
 */
export const fetchMentionUsers = async (userId: number): Promise<FollowUser[]> => {
  const body = (await neteaseApi.user_follows({
    uid: userId,
    offset: 0,
    limit: 100,
  })) as RawRecord;
  const users = Array.isArray(body.follow)
    ? body.follow
    : Array.isArray(body.data)
      ? body.data
      : [];
  return toFollowUsers(users);
};

/**
 * 按昵称搜索可供 @ 的网易云用户
 * @param keyword - 用户昵称关键词
 * @returns 用户搜索结果
 */
export const searchMentionUsers = async (keyword: string): Promise<FollowUser[]> => {
  const body = await neteaseApi.cloudsearch<RawRecord>({
    keywords: keyword,
    type: 1002,
    offset: 0,
    limit: 30,
  });
  const result = asRecord(body.result);
  return toFollowUsers(Array.isArray(result?.userprofiles) ? result.userprofiles : []);
};
