import { ipcMain } from "electron";
import {
  addComment,
  deleteComment,
  getCommentSources,
  getComments,
  likeComment,
  replyComment,
} from "@main/services/comments";
import { coreLog } from "@main/utils/logger";
import type {
  CommentAddArgs,
  CommentDeleteArgs,
  CommentLikeArgs,
  CommentMutationResponse,
  CommentQuery,
  CommentReplyArgs,
  CommentResponse,
  MusicCommentItem,
} from "@shared/types/comment";

const mutate = async (
  operation: () => Promise<void | MusicCommentItem>,
): Promise<CommentMutationResponse> => {
  try {
    const data = await operation();
    return data ? { ok: true, data } : { ok: true };
  } catch (err) {
    coreLog.warn("[comments] mutation failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

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

  ipcMain.handle("comments:add", (_evt, args: CommentAddArgs) => mutate(() => addComment(args)));
  ipcMain.handle("comments:reply", (_evt, args: CommentReplyArgs) =>
    mutate(() => replyComment(args)),
  );
  ipcMain.handle("comments:like", (_evt, args: CommentLikeArgs) => mutate(() => likeComment(args)));
  ipcMain.handle("comments:delete", (_evt, args: CommentDeleteArgs) =>
    mutate(() => deleteComment(args)),
  );
};
