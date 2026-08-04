import { describe, expect, it, vi } from "vitest";
import { addFollowComment, normalizeFollowUploadPicInfo } from "./netease";

describe("normalizeFollowUploadPicInfo", () => {
  it("使用字符串图片 ID，避免超大数字丢失精度", () => {
    const result = normalizeFollowUploadPicInfo({
      originId: Number("109951172345678900"),
      originIdStr: "109951172345678901",
      squareId: Number("109951172345678910"),
      squareIdStr: "109951172345678911",
      rectangleId: Number("109951172345678920"),
      rectangleIdStr: "109951172345678921",
      pcSquareId: Number("109951172345678930"),
      pcSquareIdStr: "109951172345678931",
      pcRectangleId: Number("109951172345678940"),
      pcRectangleIdStr: "109951172345678941",
      originJpgId: Number("109951172345678950"),
    });

    expect(result).toMatchObject({
      originId: "109951172345678901",
      squareId: "109951172345678911",
      rectangleId: "109951172345678921",
      pcSquareId: "109951172345678931",
      pcRectangleId: "109951172345678941",
    });
    expect(result).not.toHaveProperty("originJpgId");
  });
});

describe("addFollowComment", () => {
  it("返回服务端创建的评论，供列表即时插入", async () => {
    const call = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        code: 200,
        comment: {
          commentId: "123",
          content: "刚发布的评论",
          time: 1000,
          user: { userId: 1, nickname: "当前用户" },
        },
      },
    });
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { apis: { call } },
    });

    const comment = await addFollowComment("A_EV_2_1_1", "刚发布的评论");

    expect(comment).toMatchObject({
      id: "123",
      text: "刚发布的评论",
      user: { id: 1, name: "当前用户" },
    });
  });
});
