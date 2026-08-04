import type { ComputedRef, InjectionKey } from "vue";
import { inject, provide } from "vue";

export interface SidebarHoverLayoutState {
  hoverExpandActive: ComputedRef<boolean>;
  collapsed: ComputedRef<boolean>;
}

const sidebarHoverLayoutKey: InjectionKey<SidebarHoverLayoutState> = Symbol("sidebar-hover-layout");

/** 向内容区域提供悬停侧边栏的实际布局状态 */
export const provideSidebarHoverLayout = (state: SidebarHoverLayoutState): void => {
  provide(sidebarHoverLayoutKey, state);
};

/** 获取悬停侧边栏的实际布局状态 */
export const useSidebarHoverLayout = (): SidebarHoverLayoutState | null =>
  inject(sidebarHoverLayoutKey, null);
