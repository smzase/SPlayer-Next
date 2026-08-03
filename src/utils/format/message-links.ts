export type MessageTextPart = { type: "text"; value: string } | { type: "link"; value: string };

const MESSAGE_URL_PATTERN = /https?:\/\/[^\s<>"']+/giu;
const TRAILING_PUNCTUATION_PATTERN = /[\]),.!?;:，。！？；：、）】》}”’…]+$/u;

/**
 * 将私信正文拆分为普通文本与 HTTP(S) 链接
 * @param text - 私信正文
 * @returns 保持原始顺序的文本片段
 */
export const splitMessageLinks = (text: string): MessageTextPart[] => {
  const parts: MessageTextPart[] = [];
  let cursor = 0;

  const pushText = (value: string): void => {
    if (!value) return;
    const previous = parts.at(-1);
    if (previous?.type === "text") previous.value += value;
    else parts.push({ type: "text", value });
  };

  for (const match of text.matchAll(MESSAGE_URL_PATTERN)) {
    const start = match.index;
    if (start === undefined) continue;
    const candidate = match[0];
    const url = candidate.replace(TRAILING_PUNCTUATION_PATTERN, "");
    if (!url) continue;

    pushText(text.slice(cursor, start));
    parts.push({ type: "link", value: url });
    pushText(candidate.slice(url.length));
    cursor = start + candidate.length;
  }

  pushText(text.slice(cursor));
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
};
