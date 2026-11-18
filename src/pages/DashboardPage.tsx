import { PageHeader } from "@/components/common";
import { MovementList } from "@/components/MovementList";
import { buttonVariants } from "@/components/ui/button";
import { bilingualLabel, formatAud, joinMeta, locationText } from "@/lib/format";
import { cheapestOffers, supplierName } from "@/lib/inventory/catalog";
import { formatQty, getReorderSuggestions, movementsNewestFirst } from "@/lib/inventory/inventory";
import { getUnit } from "@/lib/inventory/units";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import type { InventoryState } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

function CheapestLine({ state, materialId }: { state: InventoryState; materialId: string }) {
  const best = cheapestOffers(state.supplierProducts, materialId)[0];
  if (!best) return <p className="mt-1 text-xs text-muted-foreground">还没有供应商报价。</p>;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      最低 {supplierName(state.suppliers, best.supplierId)}
      {best.supplierCode ? ` · ${best.supplierCode}` : ""} · {formatAud(best.priceExGst)} 未含 GST
    </p>
  );
}

/** 总览（#/）。 */
export function DashboardPage() {
  const { state } = useInventory();
  const reorder = getReorderSuggestions(state);
  const recent = movementsNewestFirst(state).slice(0, 6);
  const stats = [
    { href: "/inventory", label: "在册物料", value: String(state.materials.length), note: "全员同一份目录" },
    { href: "/reorder", label: "低于最低库存", value: String(reorder.length), note: "只是建议，不会下单" },
    { href: "/history", label: "流水笔数", value: String(state.movements.length), note: "只追加，不能改旧账" },
    { href: "/move", label: "记住的操作人", value: state.lastOperator || "未填写", note: "不是登录账号" },
  ];

  return (
    <div>
      <PageHeader title="库存总览">
        Coolzone Heating & Cooling 的仓库试用账。所有设备看同一份库存，新记的账使用当前时间。
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="rounded-xl bg-white p-4 ring-1 ring-foreground/10 transition hover:ring-[#1f5f78]"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-[#1c3144]">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.note}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/move?type=receipt" className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}>
          记一笔入库
        </Link>
        <Link href="/move?type=issue" className={cn(buttonVariants({ variant: "outline" }), "h-10 bg-white px-4")}>
          记一笔出库
        </Link>
        <Link href="/move?type=return" className={cn(buttonVariants({ variant: "outline" }), "h-10 bg-white px-4")}>
          记一笔退库
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        <section className="rounded-xl bg-white p-4 ring-1 ring-foreground/10 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-[#1c3144]">最近流水</h2>
            <Link href="/history" className="text-sm text-[#1f5f78]">
              全部流水
            </Link>
          </div>
          <MovementList rows={recent} materials={state.materials} suppliers={state.suppliers} compact />
        </section>

        <section className="rounded-xl bg-white p-4 ring-1 ring-foreground/10 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-[#1c3144]">待补货</h2>
            <Link href="/reorder" className="text-sm text-[#1f5f78]">
              查看建议
            </Link>
          </div>
          {reorder.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前没有低于最低库存的物料。</p>
          ) : (
            <ul className="grid gap-3">
              {reorder.slice(0, 5).map((item) => (
                <li key={item.material.id} className="border-b border-[#e6eef3] pb-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{bilingualLabel(item.material.nameZh, item.material.nameEn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {joinMeta([item.material.sku, locationText(item.material.location)])}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-sm tabular-nums">
                    现存 {formatQty(item.onHand)} / 最低 {formatQty(item.material.minStock)}{" "}
                    {getUnit(item.material.unit).label}
                    <span className="ml-2 text-[#8a4b16]">建议 {formatQty(item.suggested)}</span>
                  </p>
                  <CheapestLine state={state} materialId={item.material.id} />
                  <Link
                    href={`/move?type=receipt&material=${item.material.id}`}
                    className="mt-1 inline-block text-sm text-[#1f5f78]"
                  >
                    记一笔入库
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-[#ead9c4] bg-[#fbf6ee] p-4 text-sm leading-6 text-[#6b4423]">
        <p className="font-medium">这些数字是全员共用的。</p>
        <p>存在 Supabase 里。别的电脑打开同一个网址会看到同一份库存和流水。目前没有登录，知道网址的人都能改。不会写入 Tradify 或 monday。</p>
      </section>
    </div>
  );
}
