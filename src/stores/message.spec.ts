import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { MessageUnreadCounts } from "@/types/message";

const { fetchMessageUnreadCounts } = vi.hoisted(() => ({
  fetchMessageUnreadCounts: vi.fn<() => Promise<MessageUnreadCounts>>(),
}));

vi.mock("@/apis/message/netease", () => ({
  fetchMessageUnreadCounts,
  readAllMessageCategories: vi.fn().mockResolvedValue(undefined),
}));

import { useMessageStore } from "./message";

describe("消息未读状态", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMessageUnreadCounts.mockReset();
  });

  it("查看分类后不会被相同的服务器计数重新点亮", async () => {
    fetchMessageUnreadCounts.mockResolvedValue({
      private: 3,
      comment: 2,
      mention: 0,
      notice: 0,
    });
    const store = useMessageStore();

    await store.refreshUnread(1);
    store.markCategoryRead("private", 1);
    await store.refreshUnread(1);

    expect(store.unread).toEqual({ private: 0, comment: 2, mention: 0, notice: 0 });

    fetchMessageUnreadCounts.mockResolvedValue({
      private: 4,
      comment: 2,
      mention: 0,
      notice: 0,
    });
    await store.refreshUnread(1);

    expect(store.unread.private).toBe(1);
  });

  it("服务器计数回落时不使用旧基线遮蔽新消息", async () => {
    fetchMessageUnreadCounts.mockResolvedValue({
      private: 5,
      comment: 0,
      mention: 0,
      notice: 0,
    });
    const store = useMessageStore();

    await store.refreshUnread(1);
    store.markCategoryRead("private", 1);
    fetchMessageUnreadCounts.mockResolvedValue({
      private: 2,
      comment: 0,
      mention: 0,
      notice: 0,
    });
    await store.refreshUnread(1);

    expect(store.unread.private).toBe(2);
  });

  it("按会话最新消息时间保持私信已读状态", () => {
    const store = useMessageStore();

    store.markPrivateThreadRead(1, 2, 1000);

    expect(store.isPrivateThreadRead(1, 2, 1000)).toBe(true);
    expect(store.isPrivateThreadRead(1, 2, 1001)).toBe(false);
    expect(store.isPrivateThreadRead(1, 3, 1000)).toBe(false);
  });
});
