import { describe, expect, it } from "vitest";
import { splitMessageLinks } from "./message-links";

describe("私信链接拆分", () => {
  it("识别正文中的 HTTPS 链接", () => {
    expect(
      splitMessageLinks("查看权益到账，戳>https://music.163.com/g/vip-portal?nm_style=sbt"),
    ).toEqual([
      { type: "text", value: "查看权益到账，戳>" },
      { type: "link", value: "https://music.163.com/g/vip-portal?nm_style=sbt" },
    ]);
  });

  it("保留链接前后的换行和标点", () => {
    expect(splitMessageLinks("调查地址\n>>>http://welk.co/InMuaooGbY。\n感谢参与")).toEqual([
      { type: "text", value: "调查地址\n>>>" },
      { type: "link", value: "http://welk.co/InMuaooGbY" },
      { type: "text", value: "。\n感谢参与" },
    ]);
  });

  it("识别一条消息中的多个链接", () => {
    expect(splitMessageLinks("https://example.com/a 和 http://example.com/b")).toEqual([
      { type: "link", value: "https://example.com/a" },
      { type: "text", value: " 和 " },
      { type: "link", value: "http://example.com/b" },
    ]);
  });

  it("不把其他协议识别为链接", () => {
    expect(splitMessageLinks("javascript:alert(1)")).toEqual([
      { type: "text", value: "javascript:alert(1)" },
    ]);
  });
});
