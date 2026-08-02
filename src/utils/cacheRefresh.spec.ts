import { describe, expect, it } from "vitest";
import { DAY_MS, isCacheExpired } from "@shared/utils/cacheRefresh";

describe("isCacheExpired", () => {
  it("在刷新周期内保持有效", () => {
    expect(isCacheExpired(1_000, 7, 1_000 + 7 * DAY_MS - 1)).toBe(false);
  });

  it("到达刷新周期时过期", () => {
    expect(isCacheExpired(1_000, 7, 1_000 + 7 * DAY_MS)).toBe(true);
  });

  it("异常的非正周期至少按一天处理", () => {
    expect(isCacheExpired(1_000, 0, 1_000 + DAY_MS - 1)).toBe(false);
    expect(isCacheExpired(1_000, -10, 1_000 + DAY_MS)).toBe(true);
  });
});
