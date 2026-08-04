import { describe, expect, it, vi } from "vitest";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import follow from "./follow";
import userBlacklistUpdate from "./user_blacklist_update";
import userFollowMixed from "./user_follow_mixed";
import userMutualFollowGet from "./user_mutualfollow_get";
import userUpdate from "./user_update";

const createRequest = () =>
  vi.fn().mockResolvedValue({ status: 200, body: { code: 200 }, cookie: [] });

describe("网易云用户主页接口", () => {
  it("按目标状态关注或取消关注用户", async () => {
    const request = createRequest();

    await follow({ id: 1, t: 1 } satisfies Query, request as unknown as RequestFn);
    await follow({ id: 1, t: 0 } satisfies Query, request as unknown as RequestFn);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/user/follow/1",
      "/api/user/delfollow/1",
    ]);
  });

  it("请求关注分类和互关状态", async () => {
    const request = createRequest();

    await userFollowMixed(
      { cursor: 10, size: 30, scene: 2 } satisfies Query,
      request as unknown as RequestFn,
    );
    await userMutualFollowGet({ uid: 2 } satisfies Query, request as unknown as RequestFn);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/user/follow/users/mixed/get/v2",
      "/api/user/mutualfollow/get",
    ]);
    expect(JSON.parse(request.mock.calls[0]?.[1].page)).toEqual({ size: 30, cursor: 10 });
  });

  it("更新个人资料与黑名单", async () => {
    const request = createRequest();
    const profile = {
      nickname: "昵称",
      signature: "简介",
      gender: 1,
      birthday: 1_000,
      province: 330000,
      city: 330100,
    };

    await userUpdate(profile satisfies Query, request as unknown as RequestFn);
    await userBlacklistUpdate(
      { uid: 2, blacklisted: true } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request.mock.calls[0]?.[0]).toBe("/api/user/profile/update");
    expect(request.mock.calls[0]?.[1]).toMatchObject(profile);
    expect(request.mock.calls[1]?.[0]).toBe("/api/blacklist/add");
    expect(request.mock.calls[1]?.[1]).toEqual({ userid: 2 });
  });

  it("解除黑名单时调用官方删除端点", async () => {
    const request = createRequest();

    await userBlacklistUpdate(
      { uid: 2, blacklisted: false } satisfies Query,
      request as unknown as RequestFn,
    );

    expect(request).toHaveBeenCalledWith(
      "/api/blacklist/delete",
      { userid: 2 },
      expect.objectContaining({ crypto: "eapi" }),
    );
  });
});
