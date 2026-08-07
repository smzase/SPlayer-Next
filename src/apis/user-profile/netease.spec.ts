import { describe, expect, it, vi } from "vitest";
import {
  fetchUserConnections,
  fetchUserFollowers,
  fetchUserListeningRank,
  fetchUserPageResources,
  normalizeUserPageProfile,
} from "./netease";

describe("normalizeUserPageProfile", () => {
  it("兼容新版详情的嵌套资料与用户关系", () => {
    const profile = normalizeUserPageProfile(
      {
        data: {
          profile: {
            userId: 12,
            nickname: "测试用户",
            avatarUrl: "https://example.com/avatar.jpg",
            artistId: 99,
            backgroundUrl: "https://example.com/background.jpg",
            signature: "简介",
            gender: 2,
            birthday: 1_000,
            province: 330000,
            city: 330100,
            follows: 3,
            followeds: 4,
            eventCount: 5,
            playlistCount: 6,
            listenSongs: 7,
            followed: true,
            followMe: true,
            mutual: true,
            blacklist: false,
          },
          level: 9,
        },
      },
      12,
    );

    expect(profile).toMatchObject({
      userId: 12,
      artistId: "99",
      nickname: "测试用户",
      signature: "简介",
      gender: 2,
      birthday: 1_000,
      province: 330000,
      city: 330100,
      follows: 3,
      followeds: 4,
      eventCount: 5,
      playlistCount: 6,
      listenSongs: 7,
      level: 9,
      followed: true,
      followedBy: true,
      mutual: true,
      blacklisted: false,
    });
    expect(profile.avatarUrl).toContain("param=300y300");
  });

  it("兼容旧版顶层 profile 并为缺省计数补零", () => {
    const profile = normalizeUserPageProfile(
      {
        profile: {
          userId: 34,
          nickname: "旧版用户",
          inBlacklist: true,
        },
        level: 3,
      },
      34,
    );

    expect(profile).toMatchObject({
      userId: 34,
      nickname: "旧版用户",
      follows: 0,
      followeds: 0,
      eventCount: 0,
      playlistCount: 0,
      listenSongs: 0,
      level: 3,
      blacklisted: true,
    });
  });
});

describe("fetchUserPageResources", () => {
  it("使用稳定歌单接口按创建者分组并保留播客结果", async () => {
    const call = vi.fn().mockImplementation((_platform: string, name: string) => {
      if (name === "user_playlist") {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            code: 200,
            more: false,
            playlist: [
              {
                id: 1,
                name: "测试用户喜欢的音乐",
                creator: { userId: 12, nickname: "测试用户" },
                subscribed: false,
              },
              {
                id: 2,
                name: "收藏歌单",
                creator: { userId: 34, nickname: "其他用户" },
                subscribed: true,
              },
            ],
          },
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          code: 200,
          djRadios: [{ id: 3, name: "创建的播客", programCount: 5 }],
        },
      });
    });
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { apis: { call } },
    });

    const resources = await fetchUserPageResources(12, false);

    expect(resources.createdPlaylists.map(({ id }) => id)).toEqual(["1"]);
    expect(resources.collectedPlaylists.map(({ id }) => id)).toEqual(["2"]);
    expect(resources.createdPodcasts.map(({ id }) => id)).toEqual(["3"]);
    expect(resources.playlistAccess).toBe("available");
    expect(resources.createdPodcastsAccess).toBe("available");
    expect(resources.collectedPodcastsAccess).toBe("private");
  });

  it("歌单未公开时不会丢弃已返回的创建播客", async () => {
    const call = vi.fn().mockImplementation((_platform: string, name: string) => {
      if (name === "user_playlist") {
        return Promise.resolve({
          ok: false,
          status: 400,
          error: "netease 10004: 该歌单已被创建者设置为隐私",
          body: { code: 10004, message: "该歌单已被创建者设置为隐私" },
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          code: 200,
          djRadios: [{ id: 4, name: "公开播客", programCount: 2 }],
        },
      });
    });
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { apis: { call } },
    });

    const resources = await fetchUserPageResources(12, false);

    expect(resources.playlistAccess).toBe("private");
    expect(resources.createdPodcasts.map(({ id }) => id)).toEqual(["4"]);
  });
});

describe("fetchUserListeningRank", () => {
  it("转换听歌排行歌曲并保留播放次数", async () => {
    const call = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        code: 200,
        weekData: [
          {
            playCount: 23,
            song: {
              id: 5,
              name: "排行歌曲",
              duration: 180_000,
              artists: [{ id: 6, name: "测试歌手" }],
              album: { id: 7, name: "测试专辑" },
            },
          },
        ],
      },
    });
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { apis: { call } },
    });

    const tracks = await fetchUserListeningRank(12, "week");

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      id: "5",
      title: "排行歌曲",
      duration: 180_000,
      playCount: 23,
    });
  });
});

describe("fetchUserFollowers", () => {
  it("将服务端隐私限制作为错误抛出", async () => {
    const call = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { code: 403, message: "关注列表不可见" },
    });
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { apis: { call } },
    });

    await expect(fetchUserFollowers(12)).rejects.toThrow("关注列表不可见");
  });
});

describe("fetchUserConnections", () => {
  it("正确区分混合关注接口中的用户和歌手", async () => {
    const call = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        code: 200,
        data: {
          records: [
            {
              type: 1,
              followId: 12,
              userProfile: {
                userId: 12,
                nickname: "关注用户",
                avatarUrl: "https://example.com/user.jpg",
              },
            },
            {
              type: 2,
              followId: 34,
              artistInfo: {
                id: 34,
                name: "关注歌手",
                img1v1Url: "https://example.com/artist.jpg",
              },
            },
          ],
          page: { cursor: "1", more: false },
        },
      },
    });
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { apis: { call } },
    });

    const page = await fetchUserConnections(1, "all", true);

    expect(page.items).toMatchObject([
      { id: 12, name: "关注用户", kind: "user" },
      { id: 34, name: "关注歌手", kind: "artist" },
    ]);
    expect(page.nextCursor).toBe(1);
  });
});
