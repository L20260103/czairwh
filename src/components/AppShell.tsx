import { useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Menu,
  ScrollText,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { downloadFile, inventorySnapshotCsv, movementsCsv, reorderCsv } from "@/lib/csv";
import { countBalanceMismatches, getReorderSuggestions } from "@/lib/inventory/inventory";
import { Link, usePathname } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useInventory } from "@/store/InventoryProvider";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/inventory", label: "库存", icon: Warehouse },
  { href: "/move", label: "出入库", icon: ArrowLeftRight },
  { href: "/history", label: "流水", icon: ScrollText },
  { href: "/reorder", label: "待补货", icon: ClipboardList },
  { href: "/materials", label: "物料目录", icon: Boxes },
  { href: "/guide", label: "假设与范围", icon: BookOpen },
];

/** 手机底部导航只放前 5 个。 */
const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 5);

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#143044" />
      <path
        d="M9 22h9.5a6 6 0 0 0 0-12H9"
        fill="none"
        stroke="#d7e6f0"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M9 16.5h8" fill="none" stroke="#d08a45" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SideNav({
  pathname,
  lowCount,
  onNavigate,
}: {
  pathname: string;
  lowCount: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="grid gap-1" aria-label="主要">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              active ? "bg-[#274864] text-white" : "text-[#d5e2ec] hover:bg-[#24384c]",
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
            {item.href === "/reorder" && lowCount > 0 ? (
              <span className="ml-auto rounded-full bg-[#c4844a] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                {lowCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

type ExportKind = "inventory" | "movements" | "reorder";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, epoch, state, source, persistError, resetDemo } = useInventory();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const lowCount = getReorderSuggestions(state).length;
  const mismatchCount = ready ? countBalanceMismatches(state) : 0;

  function exportCsv(kind: ExportKind) {
    const file =
      kind === "inventory"
        ? { name: "coolzone-库存快照.csv", body: inventorySnapshotCsv(state) }
        : kind === "movements"
          ? { name: "coolzone-流水.csv", body: movementsCsv(state) }
          : { name: "coolzone-待补货建议.csv", body: reorderCsv(state) };
    // 加 BOM，Excel 打开中文不乱码。
    downloadFile(file.name, `\uFEFF${file.body}`, "text/csv;charset=utf-8");
    toast.success(`已下载 ${file.name}`);
  }

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#e8eef2] px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto w-fit">
            <Logo />
          </div>
          <p className="mt-4 text-sm font-medium text-[#1c3144]">正在读取本机试用数据…</p>
          <p className="mt-2 text-xs leading-5 text-[#6b4423]">试用原型 · 示例数据 · 未连接 Tradify/monday</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#e8eef2]">
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col bg-[#1c3144] text-[#e7eef5] lg:flex">
          <div className="flex items-center gap-3 px-4 py-5">
            <Logo />
            <div>
              <p className="text-sm font-semibold tracking-wide">Coolzone</p>
              <p className="text-[11px] text-[#b7c6d4]">Heating & Cooling · 库存试用</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            <SideNav pathname={pathname} lowCount={lowCount} />
          </div>
          <div className="shrink-0 border-t border-[#2d465c] px-4 py-4 text-xs leading-5 text-[#d5e2ec]">
            <p>本机浏览器保存。</p>
            <p>不是多人共享，也没有生产备份。</p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-[#d5dee6] bg-[#f7fafc]/95 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 lg:px-8">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger
                  render={
                    <Button variant="outline" size="icon" className="size-10 bg-white lg:hidden" aria-label="打开菜单" />
                  }
                >
                  <Menu />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 border-[#2d465c] bg-[#1c3144] text-[#e7eef5] sm:max-w-xs">
                  <SheetHeader>
                    <SheetTitle className="text-[#e7eef5]">Coolzone</SheetTitle>
                    <SheetDescription className="text-[#b7c6d4]">内部库存试用</SheetDescription>
                  </SheetHeader>
                  <div className="px-3">
                    <SideNav pathname={pathname} lowCount={lowCount} onNavigate={() => setMenuOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0 lg:hidden">
                <p className="truncate text-sm font-semibold text-[#1c3144]">Coolzone 库存试用</p>
              </div>
              <p className="hidden text-sm text-muted-foreground lg:block">墨尔本暖通仓库 · 内部试用</p>
              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" className="h-10 bg-white px-3" />}>
                    导出 CSV
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => exportCsv("inventory")}>库存快照</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCsv("movements")}>全部流水</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCsv("reorder")}>待补货建议</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" className="h-10 bg-white px-3" onClick={() => setConfirmResetOpen(true)}>
                  恢复示例
                </Button>
              </div>
            </div>
            <div
              data-testid="prototype-banner"
              className="border-t border-[#ead9c4] bg-[#fbf6ee] px-3 py-2 text-xs leading-5 text-[#6b4423] lg:px-8"
            >
              <span className="font-semibold">试用原型 · 示例数据 · 未连接 Tradify/monday</span>
              <span className="ml-2 text-[#8a6240]">供负责人审阅和改规则。不会下单，也不会写入外部系统。</span>
            </div>
            {source === "corrupt" ? (
              <div className="bg-[#fff1ef] px-3 py-2 text-xs leading-5 text-[#8d2f2f] lg:px-8" role="alert">
                本机保存的数据无法识别。现在看到的是内置示例数据，原来的存档还没被覆盖。只有确认「恢复示例」后才会清掉无法识别的内容。
              </div>
            ) : null}
            {persistError ? (
              <div
                data-testid="persist-warning"
                className="bg-[#9a3412] px-3 py-3 text-sm font-medium leading-6 text-white lg:px-8"
                role="alert"
              >
                {persistError}
              </div>
            ) : null}
            {mismatchCount > 0 ? (
              <div className="bg-[#fff8ee] px-3 py-2 text-xs leading-5 text-[#8a4b16] lg:px-8" role="status">
                有 {mismatchCount} 笔流水的变动前/后和按流水重算的结果不一致。界面和 CSV 以重算结果为准。
              </div>
            ) : null}
          </header>
          {/* key=epoch：恢复示例后整页重新挂载，表单状态清空。 */}
          <main key={epoch} className="px-3 py-5 pb-32 lg:px-8 lg:pb-10">
            {children}
          </main>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#d5dee6] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="底部"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "text-[#1f5f78]" : "text-[#5d6e7c]",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-5" />
                    {item.href === "/reorder" && lowCount > 0 ? (
                      <span className="absolute -top-1 -right-2 size-2 rounded-full bg-[#c4844a]" />
                    ) : null}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent className="w-[min(28rem,calc(100%-2rem))]" style={{ maxWidth: "28rem" }}>
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle>恢复内置示例数据？</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              将清除这台浏览器里保存的试用库存和流水，并恢复虚构的示例数据。不会影响 Tradify、monday 或任何真实业务系统。此操作不能撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmResetOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                resetDemo();
                setConfirmResetOpen(false);
                toast.success("已恢复示例数据");
              }}
            >
              确认恢复示例数据
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster theme="light" position="top-center" />
    </div>
  );
}
