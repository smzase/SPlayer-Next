import { createOption } from "../core/option";
import type { NeteaseModule } from "../core/types";

const cloudMatch: NeteaseModule = (query, request) => {
  const data = {
    userId: query.uid,
    songId: query.sid,
    adjustSongId: query.asid,
  };
  return request("/api/cloud/user/song/match", data, createOption(query, "weapi"));
};

export default cloudMatch;
