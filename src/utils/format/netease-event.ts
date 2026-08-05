import type {
  FollowComment,
  FollowCommentPage,
  FollowFeedPage,
  FollowImage,
  FollowPost,
  FollowResource,
  FollowResourceKind,
  FollowUser,
} from "@/types/follow";
import { withPicSize } from "./netease";

type RawRecord = Record<string, unknown>;

const asRecord = (value: unknown): RawRecord | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const parseRecord = (value: unknown): RawRecord | undefined => {
  const direct = asRecord(value);
  if (direct) return direct;
  if (typeof value !== "string" || !value.trim().startsWith("{")) return undefined;
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return undefined;
  }
};

const firstRecord = (...values: unknown[]): RawRecord | undefined => {
  for (const value of values) {
    const record = parseRecord(value);
    if (record) return record;
  }
  return undefined;
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const firstNumber = (...values: unknown[]): number => {
  for (const value of values) {
    const number =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const firstBoolean = (...values: unknown[]): boolean => {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
  }
  return false;
};

const artistNames = (value: unknown): string =>
  asArray(value)
    .map((item) => firstString(asRecord(item)?.name))
    .filter(Boolean)
    .join(" / ");

const toUser = (value: unknown): FollowUser => {
  const user = parseRecord(value) ?? {};
  return {
    id: firstNumber(user.userId, user.id),
    name: firstString(user.nickname, user.name),
    avatar: withPicSize(firstString(user.avatarUrl, user.avatar, user.picUrl), 96),
  };
};

const resourceRecord = (
  payload: RawRecord,
  content: RawRecord | undefined,
  type: number,
): { kind: FollowResourceKind; value: RawRecord } | undefined => {
  const directResource = asRecord(payload.resource);
  const candidates: Array<[FollowResourceKind, unknown]> = [
    ["song", content?.song],
    ["song", payload.song],
    ["artist", payload.artist],
    ["album", payload.album],
    ["playlist", payload.playlist],
    ["podcast", payload.djRadio],
    ["podcast", payload.radio],
    ["podcast", payload.program],
  ];
  const directKind: Partial<Record<number, FollowResourceKind>> = {
    13: "playlist",
    17: "podcast",
    18: "song",
    19: "album",
    28: "podcast",
    36: "artist",
  };
  const match = candidates.find(([, value]) => asRecord(value));
  if (match) return { kind: match[0], value: asRecord(match[1]) as RawRecord };
  const kind = directKind[type];
  if (kind && directResource && !directResource.mlogDetail) {
    return { kind, value: directResource };
  }
  return undefined;
};

const toResource = (
  payload: RawRecord,
  content: RawRecord | undefined,
  type: number,
): FollowResource | undefined => {
  const candidate = resourceRecord(payload, content, type);
  if (!candidate) return undefined;
  const { kind, value } = candidate;
  const radio = firstRecord(value.radio, value.djRadio);
  const album = firstRecord(value.album, value.al);
  const artists = artistNames(value.artists) || artistNames(value.ar);
  const id =
    kind === "podcast"
      ? firstString(radio?.id, value.radioId, value.id)
      : firstString(value.id, value.resourceId);
  const title =
    kind === "podcast"
      ? firstString(radio?.name, value.name, value.title)
      : firstString(value.name, value.title);
  if (!id || !title) return undefined;
  const subtitle =
    kind === "song"
      ? firstString(artists, asRecord(value.artist)?.name)
      : kind === "album"
        ? firstString(artists, asRecord(value.artist)?.name)
        : kind === "playlist"
          ? firstString(asRecord(value.creator)?.nickname, value.description)
          : kind === "podcast"
            ? firstString(asRecord(radio?.dj)?.nickname, asRecord(value.dj)?.nickname)
            : firstString(value.alias, value.trans);
  const cover = withPicSize(
    firstString(
      value.coverUrl,
      value.coverImgUrl,
      value.picUrl,
      value.img1v1Url,
      value.imageUrl,
      radio?.picUrl,
      radio?.coverUrl,
      album?.picUrl,
    ),
    160,
  );
  return {
    kind,
    id,
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(cover ? { cover } : {}),
  };
};

const toImages = (event: RawRecord, content?: RawRecord): FollowImage[] => {
  const values = [...asArray(event.pics), ...asArray(content?.image), ...asArray(content?.images)];
  return values.flatMap((value) => {
    const image = asRecord(value);
    if (!image) return [];
    const url = withPicSize(
      firstString(
        image.imageUrl,
        image.originUrl,
        image.pcRectangleUrl,
        image.rectangleUrl,
        image.pcSquareUrl,
        image.squareUrl,
        image.url,
      ),
      720,
    );
    if (!url) return [];
    const width = firstNumber(image.width, image.w, image.originWidth);
    const height = firstNumber(image.height, image.h, image.originHeight);
    return [
      {
        url,
        ...(width > 0 ? { width } : {}),
        ...(height > 0 ? { height } : {}),
      },
    ];
  });
};

const unwrapForwardedPayload = (
  type: number,
  payload: RawRecord,
): { type: number; payload: RawRecord } => {
  if (type !== 22) return { type, payload };
  const event = asRecord(payload.event);
  if (!event) return { type, payload };
  return unwrapForwardedPayload(firstNumber(event.type), parseRecord(event.json) ?? {});
};

/**
 * 将网易云原始动态转换为关注页笔记
 * @param value - 网易云动态
 * @param currentUserId - 当前登录用户 ID
 * @returns 可展示的音乐笔记
 */
export const normalizeFollowPost = (
  value: unknown,
  currentUserId: number,
): FollowPost | undefined => {
  const event = asRecord(value);
  if (!event) return undefined;
  const id = firstString(event.id, event.eventId);
  const user = toUser(event.user);
  if (!id || !user.id) return undefined;
  const outerType = firstNumber(event.type);
  const outerPayload = parseRecord(event.json) ?? {};
  const unwrapped = unwrapForwardedPayload(outerType, outerPayload);
  const mlogDetail = firstRecord(
    asRecord(unwrapped.payload.resource)?.mlogDetail,
    unwrapped.payload.mlogDetail,
  );
  const content = firstRecord(mlogDetail?.content);
  const info = asRecord(event.info) ?? {};
  const text = firstString(
    outerPayload.msg,
    content?.text,
    content?.textContent,
    content?.content,
    unwrapped.payload.msg,
  );
  const threadId = firstString(info.threadId, event.threadId) || `A_EV_2_${id}_${user.id}`;
  return {
    id,
    threadId,
    user,
    createdAt: firstNumber(event.showTime, event.eventTime, event.publishTime, event.time),
    text,
    images: toImages(event, content),
    resource: toResource(unwrapped.payload, content, unwrapped.type),
    liked: firstBoolean(info.liked, event.liked),
    likeCount: firstNumber(info.likedCount, event.likedCount),
    shareCount: firstNumber(event.forwardCount, info.shareCount, info.forwardCount),
    commentCount: firstNumber(info.commentCount, event.commentCount),
    own: user.id === currentUserId,
  };
};

/**
 * 转换关注动态分页响应
 * @param value - 网易云关注流响应
 * @param currentUserId - 当前登录用户 ID
 * @returns 关注动态分页
 */
export const normalizeFollowFeed = (value: unknown, currentUserId: number): FollowFeedPage => {
  const body = asRecord(value) ?? {};
  const data = asRecord(body.data) ?? body;
  const events = asArray(data.events).length ? asArray(data.events) : asArray(data.event);
  const items = events
    .map((event) => normalizeFollowPost(event, currentUserId))
    .filter((item): item is FollowPost => !!item);
  return {
    items,
    cursor: firstNumber(data.cursor, data.lasttime, items.at(-1)?.createdAt, -1),
    more: firstBoolean(data.more, body.more),
  };
};

const toComment = (value: unknown): FollowComment | undefined => {
  const comment = asRecord(value);
  if (!comment) return undefined;
  const id = firstString(comment.commentId, comment.id);
  const user = toUser(comment.user);
  if (!id || !user.id) return undefined;
  const replied = asRecord(asArray(comment.beReplied)[0]);
  return {
    id,
    user,
    text: firstString(comment.content, comment.text),
    createdAt: firstNumber(comment.time, comment.timeStr),
    liked: firstBoolean(comment.liked),
    likeCount: firstNumber(comment.likedCount),
    ...(replied
      ? {
          replyTo: {
            userId: firstNumber(asRecord(replied.user)?.userId, asRecord(replied.user)?.id),
            userName: firstString(asRecord(replied.user)?.nickname),
            text: firstString(replied.content),
          },
        }
      : {}),
  };
};

/**
 * 转换动态评论响应
 * @param value - 网易云评论响应
 * @returns 动态评论分页
 */
export const normalizeFollowComments = (value: unknown): FollowCommentPage => {
  const body = asRecord(value) ?? {};
  const comments = asArray(body.comments)
    .map(toComment)
    .filter((item): item is FollowComment => !!item);
  return {
    items: comments,
    more: firstBoolean(body.more),
  };
};
