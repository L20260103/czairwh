import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { getStockStatus } from "@/lib/inventory/inventory";

/** 页面标题 + 说明。 */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight text-[#1c3144]">{title}</h1>
      {children ? <div className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** 「示例数据」/「本机新增」标记。 */
export function OriginBadge({ sample }: { sample: boolean }) {
  if (sample) {
    return (
      <Badge variant="outline" className="border-[#e4c7a4] bg-[#fbf6ee] text-[#8a4b16]">
        示例数据
      </Badge>
    );
  }
  return <Badge variant="secondary">本机新增</Badge>;
}

/** 库存状态标记。 */
export function StockStatusBadges({ minStock, qty, active }: { minStock: number; qty: number; active: boolean }) {
  const status = getStockStatus(minStock, qty);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {active ? null : <Badge variant="secondary">已停用</Badge>}
      {status === "low" ? (
        <Badge variant="outline" className="border-[#e4c7a4] bg-[#fbf6ee] text-[#8a4b16]">
          低于最低
        </Badge>
      ) : null}
      {active && status === "ok" ? (
        <Badge variant="outline" className="border-[#c9e0d4] bg-[#f3faf6] text-[#1f7a4d]">
          正常
        </Badge>
      ) : null}
      {active && status === "untracked" ? <Badge variant="secondary">未监控</Badge> : null}
    </span>
  );
}

/** 表单字段：标签 + 控件 + 错误或提示。 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-[#1c3144]">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** 空列表提示。 */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#c9d5df] bg-white/70 px-4 py-10 text-center">
      <p className="font-medium text-[#1c3144]">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
