import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";

/**
 * 极简 hash 路由：地址形如 index.html#/materials?q=铜管。
 * 单文件离线打开（file://）时也能用。
 */
function readHashLocation(): { pathname: string; search: string } {
  if (typeof window === "undefined") return { pathname: "/", search: "" };
  const hash = window.location.hash.replace(/^#/, "");
  const queryStart = hash.indexOf("?");
  const rawPath = (queryStart === -1 ? hash : hash.slice(0, queryStart)) || "/";
  const pathname = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return {
    pathname: pathname === "" ? "/" : pathname,
    search: queryStart === -1 ? "" : hash.slice(queryStart + 1),
  };
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyAll() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") window.addEventListener("hashchange", notifyAll);

/** 把 href 转成 hash 里的路径。 */
export function toHashPath(href: string): string {
  if (href.startsWith("#")) return href.slice(1);
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/")) return href;
  return `/${href}`;
}

export function usePathname(): string {
  return useSyncExternalStore(
    subscribe,
    () => readHashLocation().pathname,
    () => "/",
  );
}

export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => readHashLocation().search,
    () => "",
  );
  return new URLSearchParams(search);
}

export function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...props}
      href={`#${toHashPath(href)}`}
      onClick={(event) => {
        onClick?.(event);
      }}
    />
  );
}
