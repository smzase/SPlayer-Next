import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";
import zhCN from "./zh-CN.json";

describe("消息中心中文文案", () => {
  it("保留完整中文而不是编码替换字符", () => {
    expect(zhCN.messages.title).toBe("消息");
    expect(zhCN.messages.tabs).toEqual({
      private: "私信",
      comment: "评论",
      mention: "{'@'}我",
      notice: "通知",
    });
    expect(zhCN.messages.markAllReadDone).toBe("所有消息已标记为已读");
    expect(JSON.stringify(zhCN.messages)).not.toContain("??");
  });

  it("可由 Vue I18n 编译包含 @ 的标签", () => {
    const i18n = createI18n({
      legacy: false,
      locale: "zh-CN",
      messages: { "zh-CN": zhCN },
    });

    expect(i18n.global.t("messages.tabs.mention")).toBe("@我");
  });
});
