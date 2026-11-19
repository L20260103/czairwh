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

/** 侧边栏里的页面。旧的 #/guide 不在其中，会回到总览。 */
const KNOWN_PAGE_PREFIXES = ["/inventory", "/move", "/history", "/reorder", "/materials", "/suppliers", "/categories", "/employees"];

function isKnownPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return KNOWN_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** 未知路径，以及已删除的「假设与范围」(#/guide)，改写到总览。 */
function redirectUnknownHash(): void {
  if (isKnownPage(readHashLocation().pathname)) return;
  const next = new URL(window.location.href);
  next.hash = "#/";
  window.history.replaceState(null, "", next);
}

if (typeof window !== "undefined") {
  redirectUnknownHash();
  window.addEventListener("hashchange", () => {
    redirectUnknownHash();
    notifyAll();
  });
}

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

/** 改当前页的查询串，不换路径。空值会被删掉。内容没变时不写历史。 */
export function replaceSearchParams(mutate: (params: URLSearchParams) => void): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = readHashLocation();
  const params = new URLSearchParams(search);
  mutate(params);
  for (const [key, value] of [...params.entries()]) {
    if (!value.trim()) params.delete(key);
  }
  const nextSearch = params.toString();
  if (nextSearch === new URLSearchParams(search).toString()) return;
  const url = new URL(window.location.href);
  url.hash = `${pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState(null, "", url);
  notifyAll();
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
