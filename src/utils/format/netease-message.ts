import type {
  ActivityMessage,
  ActivityMessageKind,
  MessageCategory,
  MessagePage,
  MessageImage,
  MessageResource,
  MessageResourceKind,
  MessageUnreadCounts,
  MessageUser,
  PrivateChatMessage,
  PrivateMessageThread,
} from "@/types/message";
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

const isMore = (value: unknown): boolean => value === true || value === 1 || value === "true";

const toUser = (value: unknown): MessageUser | undefined => {
  const user = parseRecord(value);
  if (!user) return undefined;
  const userId = firstNumber(user.userId, user.id);
  const nickname = firstString(user.nickname, user.name);
  if (!userId && !nickname) return undefined;
  const avatarUrl = withPicSize(firstString(user.avatarUrl, user.avatar, user.picUrl), 96);
  return { userId, nickname, ...(avatarUrl ? { avatarUrl } : {}) };
};

const artistNames = (value: unknown): string =>
  asArray(value)
    .map((item) => firstString(asRecord(item)?.name))
    .filter(Boolean)
    .join(" / ");

const toResource = (value: unknown, kind?: MessageResourceKind): MessageResource | undefined => {
  const resource = parseRecord(value);
  if (!resource) return undefined;
  const resourceType = firstString(
    resource.resourceType,
    resource.type,
    resource.kind,
  ).toLowerCase();
  const resolvedKind: MessageResourceKind | undefined =
    kind ??
    (resourceType === "song" || resourceType === "music" || resourceType === "track"
      ? "song"
      : resourceType === "album"
        ? "album"
        : resourceType === "playlist" || resourceType === "songlist"
          ? "playlist"
          : undefined);
  const album = firstRecord(resource.album, resource.al);
  const artist = firstRecord(resource.artist);
  const title = firstString(resource.name, resource.title, resource.resourceName);
  if (!title) return undefined;
  const subtitle = firstString(
    resource.subtitle,
    resource.description,
    artist?.name,
    artistNames(resource.artists),
    artistNames(resource.ar),
  );
  const imageUrl = withPicSize(
    firstString(
      resource.picUrl,
      resource.coverImgUrl,
      resource.coverUrl,
      resource.imageUrl,
      album?.picUrl,
      album?.coverImgUrl,
    ),
    128,
  );
  const rawId =
    resource.id ??
    resource.resourceId ??
    resource.songId ??
    resource.albumId ??
    resource.playlistId;
  const id =
    typeof rawId === "number" && Number.isFinite(rawId)
      ? String(rawId)
      : typeof rawId === "string"
        ? rawId.trim()
        : "";
  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(resolvedKind && id && id !== "0" ? { kind: resolvedKind, id } : {}),
  };
};

const toImage = (...values: unknown[]): MessageImage | undefined => {
  for (const value of values) {
    const image = parseRecord(value);
    if (!image) continue;
    const url = withPicSize(
      firstString(image.picUrl, image.imageUrl, image.originUrl, image.url),
      640,
    );
    if (!url) continue;
    const width = firstNumber(image.width, image.w);
    const height = firstNumber(image.height, image.h);
    return {
      url,
      ...(width > 0 ? { width } : {}),
      ...(height > 0 ? { height } : {}),
    };
  }
  return undefined;
};

const plainString = (value: unknown): string =>
  typeof value === "string" && !parseRecord(value) ? value.trim() : "";

const payloadDetails = (
  value: unknown,
): { text: string; resource?: MessageResource; image?: MessageImage } => {
  if (typeof value === "string") {
    const parsed = parseRecord(value);
    if (!parsed) return { text: value.trim() };
    return payloadDetails(parsed);
  }
  const payload = parseRecord(value);
  if (!payload) return { text: "" };
  const general = firstRecord(payload.generalMsg, payload.generalMessage);
  const content = firstRecord(general?.content, payload.content);
  const nestedMessage = firstRecord(payload.msg, payload.message, content?.msg, content?.message);
  const typedResources: Array<[MessageResourceKind, unknown]> = [
    ["song", payload.song],
    ["album", payload.album],
    ["playlist", payload.playlist],
    ["song", general?.song],
    ["album", general?.album],
    ["playlist", general?.playlist],
    ["song", content?.song],
    ["album", content?.album],
    ["playlist", content?.playlist],
    ["song", nestedMessage?.song],
    ["album", nestedMessage?.album],
    ["playlist", nestedMessage?.playlist],
  ];
  const typedResource = typedResources.find(([, candidate]) => parseRecord(candidate));
  const resourceValue =
    typedResource?.[1] ??
    payload.program ??
    payload.djRadio ??
    payload.resource ??
    general?.resource ??
    content?.resource ??
    nestedMessage?.resource;
  const resourceType = firstString(
    payload.resourceType,
    payload.type,
    general?.resourceType,
    general?.type,
    content?.resourceType,
    content?.type,
  ).toLowerCase();
  const inferredKind: MessageResourceKind | undefined =
    resourceType === "song" || resourceType === "music" || resourceType === "track"
      ? "song"
      : resourceType === "album"
        ? "album"
        : resourceType === "playlist" || resourceType === "songlist"
          ? "playlist"
          : undefined;
  const resource = toResource(resourceValue, typedResource?.[0] ?? inferredKind);
  const image = toImage(
    payload.image,
    payload.pic,
    payload.photo,
    payload.picture,
    payload.picInfo,
    payload.picinfo,
    payload.imageInfo,
    general?.image,
    general?.pic,
    general?.picInfo,
    general?.picinfo,
    content?.image,
    content?.pic,
    content?.picInfo,
    content?.picinfo,
    nestedMessage?.image,
    nestedMessage?.pic,
    nestedMessage?.photo,
    nestedMessage?.picture,
    nestedMessage?.picInfo,
    nestedMessage?.picinfo,
    nestedMessage?.imageInfo,
    nestedMessage,
    payload,
  );
  const text = firstString(
    nestedMessage?.msg,
    nestedMessage?.text,
    nestedMessage?.message,
    plainString(payload.msg),
    plainString(payload.content),
    payload.text,
    plainString(payload.message),
    general?.msg,
    general?.text,
    content?.msg,
    content?.text,
  );
  return {
    text: text || resource?.title || "",
    ...(resource ? { resource } : {}),
    ...(image ? { image } : {}),
  };
};

const findOtherUser = (raw: RawRecord, currentUserId: number): MessageUser => {
  const from = toUser(raw.fromUser);
  const to = toUser(raw.toUser);
  if (from?.userId === currentUserId && to) return to;
  if (to?.userId === currentUserId && from) return from;
  return from ?? to ?? { userId: 0, nickname: "" };
};

const listFrom = (body: RawRecord, ...keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) return value;
  }
  const data = asRecord(body.data);
  if (data) {
    for (const key of keys) {
      const value = data[key];
      if (Array.isArray(value)) return value;
    }
  }
  return Array.isArray(body.data) ? body.data : [];
};

const pageCursor = (times: number[]): number | undefined => {
  const positive = times.filter((time) => time > 0);
  return positive.length ? Math.min(...positive) : undefined;
};

/** 将 `/pl/count` 返回值转换为四类未读数量 */
export const normalizeUnreadCounts = (value: unknown): MessageUnreadCounts => {
  const body = asRecord(value) ?? {};
  return {
    private: Math.max(0, firstNumber(body.privateMsg, body.msg, body.privateMessage)),
    comment: Math.max(0, firstNumber(body.comment, body.comments)),
    mention: Math.max(0, firstNumber(body.forward, body.forwards, body.at)),
    notice:
      Math.max(0, firstNumber(body.notice, body.notices)) +
      Math.max(0, firstNumber(body.follow, body.follows)),
  };
};

/**
 * 转换私信会话列表
 * @param value - 网易云原始响应
 * @param currentUserId - 当前登录用户 ID
 */
export const normalizePrivateThreads = (
  value: unknown,
  currentUserId: number,
): MessagePage<PrivateMessageThread> => {
  const body = asRecord(value) ?? {};
  const items = listFrom(body, "msgs", "messages").flatMap((value, index) => {
    const raw = asRecord(value);
    if (!raw) return [];
    const user = findOtherUser(raw, currentUserId);
    const payload = payloadDetails(raw.lastMsg ?? raw.msg);
    const lastMessageTime = firstNumber(raw.lastMsgTime, raw.time, raw.updateTime);
    return [
      {
        id: String(raw.id ?? `${user.userId}-${lastMessageTime}-${index}`),
        user,
        lastMessage: payload.text,
        lastMessageTime,
        unreadCount: Math.max(0, firstNumber(raw.newMsgCount, raw.unreadCount)),
        ...(payload.image ? { lastMessageIsImage: true } : {}),
      },
    ];
  });
  return { items, more: isMore(body.more) };
};

/**
 * 转换私信历史
 * @param value - 网易云原始响应
 * @param currentUserId - 当前登录用户 ID
 */
export const normalizePrivateHistory = (
  value: unknown,
  currentUserId: number,
): MessagePage<PrivateChatMessage> => {
  const body = asRecord(value) ?? {};
  const items = listFrom(body, "msgs", "messages")
    .flatMap((value, index) => {
      const raw = asRecord(value);
      if (!raw) return [];
      const fromUserId = firstNumber(asRecord(raw.fromUser)?.userId, raw.fromUserId);
      const time = firstNumber(raw.time, raw.sendTime);
      const payload = payloadDetails(raw.msg ?? raw.message);
      return [
        {
          id: String(raw.id ?? raw.msgId ?? `${fromUserId}-${time}-${index}`),
          fromUserId,
          mine: fromUserId === currentUserId,
          text: payload.text,
          time,
          ...(payload.resource ? { resource: payload.resource } : {}),
          ...(payload.image ? { image: payload.image } : {}),
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
  return { items, more: isMore(body.more), cursor: pageCursor(items.map((item) => item.time)) };
};

const activityKind = (
  category: Exclude<MessageCategory, "private">,
  nested: RawRecord | undefined,
): ActivityMessageKind => {
  if (category === "comment") return "commentReply";
  if (category === "mention") return "mention";
  if (firstRecord(nested?.comment)) return "likedComment";
  if (firstRecord(nested?.playlist)) return "subscribedPlaylist";
  return "notice";
};

/**
 * 转换评论、提及和通知列表
 * @param value - 网易云原始响应
 * @param category - 消息分类
 */
export const normalizeActivityMessages = (
  value: unknown,
  category: Exclude<MessageCategory, "private">,
): MessagePage<ActivityMessage> => {
  const body = asRecord(value) ?? {};
  const keys =
    category === "comment"
      ? ["comments"]
      : category === "mention"
        ? ["forwards", "events"]
        : ["notices"];
  const items = listFrom(body, ...keys).flatMap((value, index) => {
    const raw = asRecord(value);
    if (!raw) return [];
    const comment = firstRecord(raw.comment) ?? raw;
    const event = firstRecord(raw.event);
    const eventPayload = firstRecord(event?.json, raw.json);
    const notice = firstRecord(raw.notice) ?? (category === "notice" ? raw : undefined);
    const nested = notice ?? eventPayload ?? comment;
    const relatedComment = firstRecord(nested?.comment);
    const quoted = firstRecord(asArray(comment.beReplied)[0], raw.beReplied);
    const user =
      toUser(comment.user) ??
      toUser(raw.user) ??
      toUser(raw.fromUser) ??
      toUser(event?.user) ??
      toUser(nested?.user);
    const payload = payloadDetails(eventPayload ?? notice);
    const text = firstString(
      comment.content,
      raw.content,
      raw.forwards,
      payload.text,
      notice?.message,
      notice?.text,
    );
    const detail = firstString(
      raw.beRepliedContent,
      quoted?.content,
      raw.repliedContent,
      notice?.commentContent,
      relatedComment?.content,
    );
    const resource =
      toResource(raw.resourceInfo) ??
      toResource(comment.resourceInfo) ??
      payload.resource ??
      toResource(nested?.playlist) ??
      toResource(nested?.song) ??
      toResource(nested?.resource);
    const time = firstNumber(
      raw.time,
      raw.updateTime,
      comment.time,
      event?.eventTime,
      notice?.time,
    );
    return [
      {
        id: String(raw.id ?? raw.commentId ?? comment.commentId ?? `${category}-${time}-${index}`),
        ...(user ? { user } : {}),
        kind: activityKind(category, nested),
        text,
        ...(detail ? { detail } : {}),
        time,
        ...(resource ? { resource } : {}),
      },
    ];
  });
  return {
    items,
    more: isMore(body.more),
    cursor: pageCursor(items.map((item) => item.time)),
  };
};
