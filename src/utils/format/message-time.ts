/**
 * 按消息列表密度格式化时间
 * @param time - 毫秒时间戳
 * @param locale - 当前界面语言
 * @returns 当天显示时分、当年显示月日，其余显示年月日
 */
export const formatMessageTime = (time: number, locale: string): string => {
  if (!time) return "";
  const date = new Date(time);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(locale, { month: "2-digit", day: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};
