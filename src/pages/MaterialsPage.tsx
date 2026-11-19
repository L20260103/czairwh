import { useEffect, useMemo, useRef, useState } from "react";

import { CatalogueMovementDialog } from "@/components/CatalogueMovementDialog";
import { CategoryTree } from "@/components/CategoryTree";
import { EmptyState, PageHeader } from "@/components/common";
import { MaterialDetailDialog } from "@/components/MaterialDetailDialog";
import { MaterialDialog } from "@/components/MaterialDialog";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bilingualLabel, formatAud, joinMeta, locationText, movementTypeLabel } from "@/lib/format";
import { categoryMaterialCounts, categoryPath, cheapestOffers, descendantIds, supplierName } from "@/lib/inventory/catalog";
import { CATALOGUE_PAGE_SIZE } from "@/lib/inventory/catalogueSearch";
import { consumableCategoryIds, formatQty, fromCents, movementsNewestFirst, onHandCentsByMaterial, stockedMaterialIds } from "@/lib/inventory/inventory";
import { queryCatalogue } from "@/lib/inventory/remote";
import { readRecentMaterialIds, rememberMaterialId } from "@/lib/inventory/recentMaterials";
import { specSummary } from "@/lib/inventory/specs";
import type { Material, MovementType, Supplier, SupplierProduct } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { replaceSearchParams, useSearchParams } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useInventory } from "@/store/InventoryProvider";

const NO_OFFERS: SupplierProduct[] = [];

/** 物料目录（#/materials）。一页 50 条，筛选放在查询串里。 */
export function MaterialsPage() {
  const params = useSearchParams();
  const { state } = useInventory();
  const queryParam = params.get("q") ?? "";
  const categoryId = params.get("category") ?? "";
  const supplierId = params.get("supplier") ?? "";
  const stockOnly = params.get("stock") === "1";
  const consumableOnly = params.get("consumable") === "1";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [searchInput, setSearchInput] = useState(queryParam);
  const writtenQuery = useRef<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [rows, setRows] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentMaterialIds());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [acting, setActing] = useState<{ material: Material; type: MovementType } | null>(null);

  useEffect(() => {
    if (writtenQuery.current === null) {
      writtenQuery.current = queryParam;
      return;
    }
    if (queryParam === writtenQuery.current) return;
    writtenQuery.current = queryParam;
    setSearchInput(queryParam);
  }, [queryParam]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === writtenQuery.current) return;
      writtenQuery.current = next;
      replaceSearchParams((nextParams) => {
        if (next) nextParams.set("q", next);
        else nextParams.delete("q");
        nextParams.delete("page");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const consumableIds = useMemo(() => consumableCategoryIds(state.categories), [state.categories]);
  const categoryFilterIds = useMemo(() => {
    const selected = categoryId ? descendantIds(state.categories, categoryId) : null;
    if (!consumableOnly) return selected ? [...selected] : null;
    if (!selected) return [...consumableIds];
    return [...selected].filter((id) => consumableIds.has(id));
  }, [categoryId, consumableIds, consumableOnly, state.categories]);
  const stockIds = useMemo(() => {
    if (!stockOnly) return null;
    const totals = onHandCentsByMaterial(state);
    const ids: string[] = [];
    for (const [id, cents] of totals) if (cents > 0) ids.push(id);
    return ids;
  }, [state, stockOnly]);
  const categoryKey = categoryFilterIds ? categoryFilterIds.slice().sort().join(",") : "";
  const stockKey = stockIds ? stockIds.slice().sort().join(",") : "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void queryCatalogue({
      search: queryParam,
      categoryIds: categoryFilterIds,
      supplierId: supplierId || null,
      materialIds: stockIds,
      page: page - 1,
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setRows([]);
        setTotal(0);
      } else {
        setError(null);
        setRows(result.materials);
        setTotal(result.total);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // categoryKey / stockKey 代表 id 集合。state.materials 变了要重读目录。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, categoryKey, page, queryParam, state.materials, stockKey, supplierId]);

  useEffect(() => {
    if (loading || error) return;
    const pages = Math.max(1, Math.ceil(total / CATALOGUE_PAGE_SIZE));
    if (page <= pages) return;
    replaceSearchParams((nextParams) => {
      if (pages <= 1) nextParams.delete("page");
      else nextParams.set("page", String(pages));
    });
  }, [error, loading, page, total]);

  const counts = useMemo(
    () => categoryMaterialCounts(state.categories, state.materials),
    [state.categories, state.materials],
  );
  const onHand = useMemo(() => onHandCentsByMaterial(state), [state]);
  const stocked = useMemo(() => stockedMaterialIds(state), [state]);
  const offersByMaterial = useMemo(() => {
    const wanted = new Set(rows.map((row) => row.id));
    const map = new Map<string, SupplierProduct[]>();
    for (const offer of state.supplierProducts) {
      if (!wanted.has(offer.materialId)) continue;
      const bucket = map.get(offer.materialId);
      if (bucket) bucket.push(offer);
      else map.set(offer.materialId, [offer]);
    }
    return map;
  }, [rows, state.supplierProducts]);

  const supplierOptions = useMemo(() => {
    const used = new Set(state.supplierProducts.map((offer) => offer.supplierId));
    const options = state.suppliers
      .filter((supplier) => used.has(supplier.id) || supplier.id === supplierId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "en"))
      .map((supplier) => ({ value: supplier.id, label: supplier.name }));
    return [{ value: "all", label: "全部供应商" }, ...options];
  }, [state.supplierProducts, state.suppliers, supplierId]);

  const recentMaterials = useMemo(() => {
    const byId = new Map(state.materials.map((material) => [material.id, material]));
    for (const row of rows) byId.set(row.id, row);
    const fromMovements: string[] = [];
    for (const movement of movementsNewestFirst(state)) {
      if (fromMovements.includes(movement.materialId)) continue;
      fromMovements.push(movement.materialId);
      if (fromMovements.length >= 8) break;
    }
    const ids: string[] = [];
    for (const id of [...recentIds, ...fromMovements]) {
      if (ids.includes(id) || !byId.has(id)) continue;
      ids.push(id);
      if (ids.length >= 12) break;
    }
    return ids.map((id) => byId.get(id)!);
  }, [recentIds, rows, state]);

  function setParam(key: string, value: string) {
    replaceSearchParams((nextParams) => {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
      nextParams.delete("page");
    });
  }

  function setPage(nextPage: number) {
    replaceSearchParams((nextParams) => {
      if (nextPage <= 1) nextParams.delete("page");
      else nextParams.set("page", String(nextPage));
    });
  }

  function remember(material: Material) {
    setRecentIds(rememberMaterialId(material.id));
  }

  function openDetail(material: Material) {
    remember(material);
    setDetailId(material.id);
  }

  function openAct(material: Material, type: MovementType) {
    remember(material);
    setActing({ material, type });
  }

  function findMaterial(id: string | null): Material | null {
    if (!id) return null;
    return rows.find((material) => material.id === id) ?? state.materials.find((material) => material.id === id) ?? null;
  }

  const detail = findMaterial(detailId);
  const selectedCategory = state.categories.find((category) => category.id === categoryId);
  const filtersActive = !!(queryParam || categoryId || supplierId || stockOnly || consumableOnly);
  const pageCount = Math.max(1, Math.ceil(total / CATALOGUE_PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * CATALOGUE_PAGE_SIZE + 1;
  const end = Math.min(total, page * CATALOGUE_PAGE_SIZE);

  return (
    <div data-testid="catalogue-page">
      <PageHeader title="物料目录">
        按类别、供应商、库存和规格找物料，一页 {CATALOGUE_PAGE_SIZE} 条。点名称看库存、报价和流水。入库、出库、退库记进同一本流水，出库不能超过当前库存。
      </PageHeader>

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-4">
        <aside className="mb-4 hidden rounded-xl bg-white p-3 ring-1 ring-foreground/10 lg:sticky lg:top-24 lg:mb-0 lg:block lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-auto">
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">类别</p>
          <CategoryTree
            categories={state.categories}
            counts={counts}
            total={state.materials.length}
            selectedId={categoryId}
            onSelect={(id) => setParam("category", id)}
          />
        </aside>

        <div className="min-w-0">
          <div className="mb-3 lg:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-between bg-white"
              onClick={() => setTreeOpen(true)}
            >
              <span className="truncate">
                {selectedCategory ? bilingualLabel(selectedCategory.nameZh, selectedCategory.nameEn) : "全部类别"}
              </span>
              <span className="text-xs text-muted-foreground">筛选</span>
            </Button>
            <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>类别</SheetTitle>
                  <SheetDescription>点一个类别，只看它和它的下级。</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                  <CategoryTree
                    categories={state.categories}
                    counts={counts}
                    total={state.materials.length}
                    selectedId={categoryId}
                    onSelect={(id) => {
                      setParam("category", id);
                      setTreeOpen(false);
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索 SKU、名称或规格，例如 250-200"
              className="h-11 bg-white"
              aria-label="搜索物料目录"
              data-testid="catalogue-search"
            />
            <Button className="h-11 px-4" onClick={() => setEditing("new")}>
              新增物料
            </Button>
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="w-full sm:w-56">
              <OptionSelect
                label="供应商"
                value={supplierOptions.some((option) => option.value === (supplierId || "all")) ? supplierId || "all" : "all"}
                onChange={(value) => setParam("supplier", value === "all" ? "" : value)}
                options={supplierOptions}
              />
            </div>
            <FilterToggle pressed={stockOnly} onClick={() => setParam("stock", stockOnly ? "" : "1")} testId="filter-stock">
              只看有库存
            </FilterToggle>
            <FilterToggle
              pressed={consumableOnly}
              onClick={() => setParam("consumable", consumableOnly ? "" : "1")}
              testId="filter-consumable"
            >
              只看耗材
            </FilterToggle>
            {filtersActive ? (
              <button
                type="button"
                className="h-11 px-1 text-sm text-[#1f5f78]"
                onClick={() => {
                  writtenQuery.current = "";
                  setSearchInput("");
                  replaceSearchParams((nextParams) => {
                    nextParams.delete("q");
                    nextParams.delete("category");
                    nextParams.delete("supplier");
                    nextParams.delete("stock");
                    nextParams.delete("consumable");
                    nextParams.delete("page");
                  });
                }}
              >
                清除筛选
              </button>
            ) : null}
          </div>

          {recentMaterials.length > 0 ? (
            <section className="mb-4" aria-label="最近用过">
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">最近用过</h2>
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {recentMaterials.map((material) => (
                  <li key={material.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => openDetail(material)}
                      className="max-w-56 rounded-full bg-white px-3 py-1.5 text-left ring-1 ring-foreground/10 hover:ring-[#1f5f78]"
                    >
                      <span className="block truncate text-sm font-medium text-[#1c3144]">
                        {bilingualLabel(material.nameZh, material.nameEn)}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {material.sku} · {formatQty(fromCents(onHand.get(material.id) ?? 0))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="mb-3 text-xs text-muted-foreground" data-testid="catalogue-summary">
            {loading ? "正在读取目录…" : `第 ${start}–${end} 条，共 ${total} 条`}
            {error ? ` · ${error}` : ""}
          </p>

          {error ? (
            <Button type="button" variant="outline" className="mb-3 h-10 bg-white" onClick={() => setAttempt((value) => value + 1)}>
              重试
            </Button>
          ) : null}

          {!loading && !error && rows.length === 0 ? (
            <EmptyState title={filtersActive ? "目录里没有匹配的物料" : "目录还是空的"}>
              {filtersActive ? "换个关键词，或清除筛选。" : "点「新增物料」添加第一条。如果还没有类别，要先去类别页。"}
            </EmptyState>
          ) : rows.length === 0 ? null : (
            <>
              <div className={cn("hidden rounded-xl bg-white ring-1 ring-foreground/10 lg:block", loading && "opacity-60")}>
                <Table aria-label="物料目录" className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">SKU / 名称</TableHead>
                      <TableHead className="w-[18%]">类别</TableHead>
                      <TableHead className="w-[12%]">库存</TableHead>
                      <TableHead className="w-[16%]">报价</TableHead>
                      <TableHead className="w-[24%]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((material) => (
                      <TableRow key={material.id} data-testid="catalogue-row" data-sku={material.sku}>
                        <TableCell className="whitespace-normal">
                          <button type="button" className="text-left font-medium break-words text-[#1c3144] hover:text-[#1f5f78]" onClick={() => openDetail(material)}>
                            {bilingualLabel(material.nameZh, material.nameEn)}
                          </button>
                          <SpecLine specs={material.specs} />
                          <p className="mt-1 text-xs break-all text-muted-foreground">{material.sku}</p>
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs break-words text-muted-foreground">
                          {categoryPath(state.categories, material.categoryId) || "未分类"}
                        </TableCell>
                        <TableCell className="whitespace-normal tabular-nums">
                          {formatQty(fromCents(onHand.get(material.id) ?? 0))}{" "}
                          <span className="text-xs text-muted-foreground">{getUnit(material.unit).label}</span>
                          {stocked.has(material.id) ? null : (
                            <span className="mt-1 block text-[11px] text-muted-foreground">未入过库</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs break-words">
                          <OfferLine offers={offersByMaterial.get(material.id) ?? NO_OFFERS} suppliers={state.suppliers} />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex flex-wrap gap-1">
                            <ActButtons onAct={(type) => openAct(material, type)} />
                            <Button type="button" variant="outline" size="sm" className="h-9 bg-white" onClick={() => setEditing(material)}>
                              编辑
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className={cn("grid gap-3 lg:hidden", loading && "opacity-60")}>
                {rows.map((material) => {
                  const summary = specSummary(material.specs);
                  return (
                    <li key={material.id} data-testid="catalogue-row" data-sku={material.sku} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
                      <button type="button" className="text-left" onClick={() => openDetail(material)}>
                        <p className="text-xs text-muted-foreground">{material.sku}</p>
                        <h2 className="font-semibold text-[#1c3144]">{bilingualLabel(material.nameZh, material.nameEn)}</h2>
                      </button>
                      {summary ? <p className="mt-1 text-sm leading-5 text-[#1f5f78]">{summary}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {joinMeta([
                          categoryPath(state.categories, material.categoryId) || "未分类",
                          locationText(material.location),
                        ])}
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#1c3144]">
                        {formatQty(fromCents(onHand.get(material.id) ?? 0))}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">{getUnit(material.unit).label}</span>
                      </p>
                      {stocked.has(material.id) ? null : <p className="text-[11px] text-muted-foreground">未入过库</p>}
                      <div className="mt-1 text-xs">
                        <OfferLine offers={offersByMaterial.get(material.id) ?? NO_OFFERS} suppliers={state.suppliers} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <ActButtons block onAct={(type) => openAct(material, type)} />
                      </div>
                      <Button type="button" variant="outline" className="mt-2 h-9 w-full bg-white" onClick={() => setEditing(material)}>
                        编辑
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {total > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                第 {page} / {pageCount} 页
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-10 bg-white" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 bg-white"
                  disabled={page >= pageCount}
                  onClick={() => setPage(page + 1)}
                  data-testid="catalogue-next"
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {detail ? (
        <MaterialDetailDialog
          key={detail.id}
          material={detail}
          onClose={() => setDetailId(null)}
          onAct={(type) => openAct(detail, type)}
          onEdit={() => {
            setEditing(detail);
            setDetailId(null);
          }}
        />
      ) : null}
      {acting ? (
        <CatalogueMovementDialog
          key={`${acting.type}:${acting.material.id}`}
          material={acting.material}
          type={acting.type}
          onClose={() => setActing(null)}
          onRecorded={(id) => setRecentIds(rememberMaterialId(id))}
        />
      ) : null}
      {editing ? (
        <MaterialDialog
          key={editing === "new" ? "new" : editing.id}
          material={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function FilterToggle({
  pressed,
  onClick,
  testId,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  testId: string;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "h-11 rounded-lg border px-3 text-sm",
        pressed ? "border-[#1f5f78] bg-[#e7f2f6] font-medium text-[#1f5f78]" : "border-[#d5dee6] bg-white text-[#1c3144]",
      )}
    >
      {children}
    </button>
  );
}

function ActButtons({ onAct, block }: { onAct: (type: MovementType) => void; block?: boolean }) {
  return (
    <>
      {(["receipt", "issue", "return"] as const).map((type) => (
        <Button
          key={type}
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-9 bg-white", block && "w-full")}
          onClick={() => onAct(type)}
        >
          {movementTypeLabel(type)}
        </Button>
      ))}
    </>
  );
}

function SpecLine({ specs }: { specs: Material["specs"] }) {
  const summary = specSummary(specs);
  if (!summary) return null;
  return <p className="mt-0.5 text-xs leading-5 text-[#1f5f78]">{summary}</p>;
}

function OfferLine({ offers, suppliers }: { offers: SupplierProduct[]; suppliers: Supplier[] }) {
  const best = cheapestOffers(offers, offers[0]?.materialId ?? "")[0];
  if (!best) return <span className="text-muted-foreground">还没有报价</span>;
  return (
    <span>
      {supplierName(suppliers, best.supplierId)} · {formatAud(best.priceExGst)} 未含 GST
    </span>
  );
}
