import { useMemo, useState } from "react";

import { EmptyState, PageHeader, ShowMore, StockStatusBadges, useVisibleLimit } from "@/components/common";
import { OptionSelect } from "@/components/OptionSelect";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bilingualLabel, displayLocation, joinMeta, locationText } from "@/lib/format";
import { categoryPath, categorySelectOptions, descendantIds } from "@/lib/inventory/catalog";
import { specSearchText, specSummary } from "@/lib/inventory/specs";
import { formatQty, fromCents, getStockStatus, onHandCentsByMaterial, stockedMaterialIds } from "@/lib/inventory/inventory";
import type { MovementType } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { Link, useSearchParams } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useInventory } from "@/store/InventoryProvider";

/** 库存（#/inventory?q=&category=&low=1）。 */
export function InventoryPage() {
  const params = useSearchParams();
  const { state } = useInventory();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [location, setLocation] = useState("all");
  const [lowOnly, setLowOnly] = useState(params.get("low") === "1");
  const [showAll, setShowAll] = useState(false);

  const categories = useMemo(() => categorySelectOptions(state.categories), [state.categories]);
  const onHand = useMemo(() => onHandCentsByMaterial(state), [state]);
  const stockedIds = useMemo(() => stockedMaterialIds(state), [state]);
  // 默认只看仓库里真正入过库的物料。库存用到 0 的仍留下；纯目录货要打开「显示全部物料」才出现。
  const universe = useMemo(
    () => (showAll ? state.materials : state.materials.filter((material) => stockedIds.has(material.id))),
    [showAll, state.materials, stockedIds],
  );
  const locations = useMemo(
    () => ["all", ...new Set(universe.map((m) => locationText(m.location)))],
    [universe],
  );
  if (location !== "all" && !locations.includes(location)) {
    setLocation("all");
  }
  const categoryIds = useMemo(
    () => (category === "all" ? null : descendantIds(state.categories, category)),
    [category, state.categories],
  );
  const indexed = useMemo(
    () =>
      universe.map((material) => ({
        material,
        stocked: stockedIds.has(material.id),
        qty: fromCents(onHand.get(material.id) ?? 0),
        haystack:
          `${material.sku} ${material.nameZh} ${material.nameEn} ${categoryPath(state.categories, material.categoryId)} ${locationText(material.location)} ${material.note} ${specSearchText(material.specs)}`.toLowerCase(),
      })),
    [onHand, state.categories, stockedIds, universe],
  );

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      indexed
        .filter(({ material, qty, haystack, stocked }) => {
          if (
            (categoryIds && !categoryIds.has(material.categoryId)) ||
            (location !== "all" && locationText(material.location) !== location) ||
            (lowOnly && (!stocked || getStockStatus(material.minStock, qty) !== "low"))
          )
            return false;
          return q ? haystack.includes(q) : true;
        })
        .sort((a, b) => {
          // 低于最低库存的在库物料排前面，其余按 SKU。没入过库的不按缺货排。
          const rankA = a.stocked && getStockStatus(a.material.minStock, a.qty) === "low" ? 0 : 1;
          const rankB = b.stocked && getStockStatus(b.material.minStock, b.qty) === "low" ? 0 : 1;
          if (rankA !== rankB) return rankA - rankB;
          return a.material.sku.localeCompare(b.material.sku);
        }),
    [categoryIds, indexed, location, lowOnly, q],
  );
  const [visibleLimit, showMore] = useVisibleLimit(`${q}|${category}|${location}|${lowOnly}|${showAll}`);
  const visibleRows = rows.length > visibleLimit ? rows.slice(0, visibleLimit) : rows;

  return (
    <div>
      <PageHeader title="库存">
        {showAll
          ? "正在连同还没入过库的目录物料一起显示。没记过流水的不标成缺货。数量来自流水，不在这里直接改。名称显示为「中文 English」。"
          : "只列出在本仓库有过出入库记录的物料，数量用到 0 的也会留下。供应商目录里还没入过库的货不在这里。数量来自流水，不在这里直接改。低于最低库存的排在前面。名称显示为「中文 English」。"}
      </PageHeader>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索 SKU、名称、库位"
          className="h-11 min-w-48 flex-1 bg-white"
          aria-label="搜索库存"
        />
        <div className="w-full sm:w-48">
          <OptionSelect
            label="类别"
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: "全部类别" }, ...categories]}
          />
        </div>
        <div className="w-full sm:w-48">
          <OptionSelect
            label="库位"
            value={location}
            onChange={setLocation}
            options={locations.map((l) => ({ value: l, label: l === "all" ? "全部库位" : displayLocation(l) }))}
          />
        </div>
        <Button
          type="button"
          variant={lowOnly ? "default" : "outline"}
          className={cn("h-11", !lowOnly && "bg-white")}
          onClick={() => setLowOnly((value) => !value)}
          aria-pressed={lowOnly}
        >
          只看低于最低
        </Button>
        <Button
          type="button"
          variant={showAll ? "default" : "outline"}
          className={cn("h-11", !showAll && "bg-white")}
          onClick={() => setShowAll((value) => !value)}
          aria-pressed={showAll}
        >
          显示全部物料
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        显示 {rows.length} / {universe.length}
      </p>
      {universe.length === 0 ? (
        <EmptyState title={state.materials.length === 0 ? "还没有物料" : "仓库里还没有入过库的物料"}>
          {state.materials.length === 0 ? (
            <Link href="/materials" className="text-[#1f5f78]">
              到物料目录新增第一条
            </Link>
          ) : (
            <Link href="/move" className="text-[#1f5f78]">
              到出入库记下第一笔
            </Link>
          )}
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="没有符合筛选的物料">
          <button
            type="button"
            className="text-[#1f5f78]"
            onClick={() => {
              setQuery("");
              setCategory("all");
              setLocation("all");
              setLowOnly(false);
              setShowAll(false);
            }}
          >
            清除筛选
          </button>
        </EmptyState>
      ) : (
        <>
          <div className="hidden rounded-xl bg-white ring-1 ring-foreground/10 lg:block">
            <Table aria-label="库存列表">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU / 名称</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead>库位</TableHead>
                  <TableHead>当前库存</TableHead>
                  <TableHead>最低</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>记账</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map(({ material, qty, stocked }) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div className="font-medium">{bilingualLabel(material.nameZh, material.nameEn)}</div>
                      <SpecSummary specs={material.specs} />
                      <div className="mt-1 text-xs text-muted-foreground">{material.sku}</div>
                    </TableCell>
                    <TableCell>{categoryPath(state.categories, material.categoryId)}</TableCell>
                    <TableCell>{displayLocation(material.location)}</TableCell>
                    <TableCell className="text-base font-semibold tabular-nums">
                      {formatQty(qty)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">{getUnit(material.unit).label}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatQty(material.minStock)}</TableCell>
                    <TableCell>
                      <StockStatusBadges minStock={material.minStock} qty={qty} active={material.active} stocked={stocked} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <MoveLink id={material.id} type="receipt" label="入库" />
                        <MoveLink id={material.id} type="issue" label="出库" />
                        <MoveLink id={material.id} type="return" label="退库" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-3 lg:hidden">
            {visibleRows.map(({ material, qty, stocked }) => (
              <li key={material.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{material.sku}</p>
                    <h2 className="font-semibold">{bilingualLabel(material.nameZh, material.nameEn)}</h2>
                    <SpecSummary specs={material.specs} />
                    <p className="text-xs text-muted-foreground">
                      {joinMeta([categoryPath(state.categories, material.categoryId), locationText(material.location)])}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatQty(qty)}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">{getUnit(material.unit).label}</span>
                  </p>
                  <StockStatusBadges minStock={material.minStock} qty={qty} active={material.active} stocked={stocked} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">最低 {formatQty(material.minStock)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MoveLink id={material.id} type="receipt" label="入库" block />
                  <MoveLink id={material.id} type="issue" label="出库" block />
                  <MoveLink id={material.id} type="return" label="退库" block />
                </div>
              </li>
            ))}
          </ul>
          {rows.length > visibleRows.length ? <ShowMore onClick={showMore} /> : null}
        </>
      )}
    </div>
  );
}

function SpecSummary({ specs }: { specs: Record<string, unknown> }) {
  const summary = specSummary(specs);
  if (!summary) return null;
  return <p className="mt-0.5 text-xs leading-5 text-[#1f5f78]">{summary}</p>;
}

/** 跳到出入库页并预选物料和类型。 */
function MoveLink({ id, type, label, block }: { id: string; type: MovementType; label: string; block?: boolean }) {
  return (
    <Link
      href={`/move?type=${type}&material=${id}`}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 bg-white", block && "w-full")}
    >
      {label}
    </Link>
  );
}
