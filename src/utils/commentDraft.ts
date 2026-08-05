export const COMMENT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY = "splayer-comment-drafts-v1";
const MAX_DRAFTS = 50;

interface CommentDraft {
  text: string;
  expiresAt: number;
}

type CommentDraftStore = Record<string, CommentDraft>;

const readStore = (): CommentDraftStore => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as CommentDraftStore)
      : {};
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
};

const pruneStore = (store: CommentDraftStore, now: number): CommentDraftStore =>
  Object.fromEntries(
    Object.entries(store)
      .filter((entry): entry is [string, CommentDraft] => {
        const draft = entry[1];
        return (
          typeof draft?.text === "string" &&
          typeof draft.expiresAt === "number" &&
          draft.expiresAt > now
        );
      })
      .sort((left, right) => right[1].expiresAt - left[1].expiresAt)
      .slice(0, MAX_DRAFTS),
  );

const writeStore = (store: CommentDraftStore): void => {
  if (Object.keys(store).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

/**
 * 读取仍在有效期内的评论草稿
 * @param key - 评论资源与回复对象组成的草稿键
 * @returns 草稿正文
 */
export const loadCommentDraft = (key: string): string => {
  if (!key) return "";
  const store = pruneStore(readStore(), Date.now());
  writeStore(store);
  return store[key]?.text ?? "";
};

/**
 * 保存一天内有效的评论草稿
 * @param key - 评论资源与回复对象组成的草稿键
 * @param text - 草稿正文
 */
export const saveCommentDraft = (key: string, text: string): void => {
  if (!key || !text.trim()) {
    removeCommentDraft(key);
    return;
  }
  const now = Date.now();
  const store = pruneStore(readStore(), now);
  store[key] = { text, expiresAt: now + COMMENT_DRAFT_TTL_MS };
  writeStore(pruneStore(store, now));
};

/**
 * 删除指定评论草稿
 * @param key - 评论资源与回复对象组成的草稿键
 */
export const removeCommentDraft = (key: string): void => {
  if (!key) return;
  const store = pruneStore(readStore(), Date.now());
  delete store[key];
  writeStore(store);
};
