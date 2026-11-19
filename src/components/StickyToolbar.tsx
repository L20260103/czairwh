import { useCallback, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 把元素边框盒高度写到 <html> 上，供吸顶条和表头计算 top。
 * 用回调 ref：顶栏在数据加载完才挂上，高度变了（换行、横幅、展开「最近用过」）也会跟着更新。
 */
export function useElementHeightVar(name: `--${string}`) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      const root = document.documentElement;
      if (!el) {
        root.style.setProperty(name, "0px");
        return;
      }
      const apply = () => {
        root.style.setProperty(name, `${el.getBoundingClientRect().height}px`);
      };
      apply();
      const observer = new ResizeObserver(apply);
      observer.observe(el);
      cleanupRef.current = () => {
        observer.disconnect();
        root.style.setProperty(name, "0px");
      };
    },
    [name],
  );
  return setRef;
}

/**
 * 列表页的搜索 / 筛选条。position: sticky，贴在应用顶栏下面。
 * 背景用不透明的页面色，避免行滚到条下面时透出来。
 * z-20：高于表格行和表头（z-10），低于顶栏（z-30）以及对话框、下拉（z-50 / z-80）。
 * 祖先不能是 overflow: hidden/auto，否则吸顶会失效。
 */
export function StickyToolbar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useElementHeightVar("--sticky-toolbar-height");

  return (
    <div
      ref={ref}
      data-slot="sticky-toolbar"
      data-testid="sticky-toolbar"
      className={cn("sticky z-20 border-b border-[#d5dee6] bg-[#e8eef2] pt-2 pb-3", className)}
      style={{ top: "calc(var(--app-header-offset, 0px) - 1px)" }}
    >
      {children}
    </div>
  );
}
