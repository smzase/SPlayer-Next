import { ipcMain } from "electron";
import { getCommentSources, getComments } from "@main/services/comments";
import { coreLog } from "@main/utils/logger";
import type { CommentQuery, CommentResponse } from "@shared/types/comment";

/** 注册评论 IPC */
export const registerCommentsIpc = (): void => {
  ipcMain.handle("comments:sources", () => getCommentSources());

  ipcMain.handle("comments:get", async (_evt, args: CommentQuery): Promise<CommentResponse> => {
    try {
      return { ok: true, data: await getComments(args) };
    } catch (err) {
      coreLog.warn("[comments] get failed:", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
};
