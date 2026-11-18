import type { ReactNode } from "react";

import { AUTH_REQUIRED } from "@/lib/supabase/access";

/**
 * 登录门的占位，现在没有挂到 App 上。
 * 启用步骤见 src/lib/supabase/access.ts。不要在这里做公开注册。
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!AUTH_REQUIRED) return children;
  return (
    <div className="grid min-h-dvh place-items-center bg-[#e8eef2] px-6">
      <p className="max-w-md text-center text-sm leading-6 text-[#1c3144]">
        登录还没接上。请先把 AUTH_REQUIRED 改回 false，或在 AuthGate 里接上 Supabase 邮箱密码登录。账号由管理员在后台创建，不要做公开注册。
      </p>
    </div>
  );
}
