import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMENT_DRAFT_TTL_MS,
  loadCommentDraft,
  removeCommentDraft,
  saveCommentDraft,
} from "./commentDraft";

describe("评论草稿", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("按评论与回复对象分别保存", () => {
    saveCommentDraft("song:1:new", "发表评论草稿");
    saveCommentDraft("song:1:reply:2", "回复草稿");

    expect(loadCommentDraft("song:1:new")).toBe("发表评论草稿");
    expect(loadCommentDraft("song:1:reply:2")).toBe("回复草稿");
  });

  it("一天后自动清除", () => {
    saveCommentDraft("song:1:new", "即将过期");
    vi.advanceTimersByTime(COMMENT_DRAFT_TTL_MS);

    expect(loadCommentDraft("song:1:new")).toBe("");
  });

  it("退出时可以主动清除", () => {
    saveCommentDraft("song:1:new", "不再保留");
    removeCommentDraft("song:1:new");

    expect(loadCommentDraft("song:1:new")).toBe("");
  });
});
