/** 播客摘要 */
export interface Podcast {
  id: string;
  name: string;
  cover?: string;
  description?: string;
  creator?: string;
  creatorId?: number;
  programCount: number;
  createTime?: number;
  updateTime?: number;
}
