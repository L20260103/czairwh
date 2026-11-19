import { useMemo, useState } from "react";

import { EmptyState, PageHeader } from "@/components/common";
import { BilingualName } from "@/components/BilingualName";
import { StickySearch, StickyToolbar } from "@/components/StickyToolbar";
import { OptionSelect } from "@/components/OptionSelect";
import { SupplierDialog } from "@/components/SupplierDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bilingualLabel, formatAud, joinMeta } from "@/lib/format";
import { categoryPath, categorySelectOptions, descendantIds } from "@/lib/inventory/catalog";
import { specSearchText } from "@/lib/inventory/specs";
import type { Category, Material, Supplier, SupplierProduct } from "@/lib/inventory/types";
import { Link, usePathname } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useInventory } from "@/store/InventoryProvider";

const PAGE_SIZE = 50;
const countFormat = new Intl.NumberFormat("en-US");

function formatCount(value: number): string {
  return countFormat.format(value);
}

/** 供应商（#/suppliers）和某一家的产品（#/suppliers/:id）。 */
export function SuppliersPage() {
  const pathname = usePathname();
  const prefix = "/suppliers/";
  if (pathname.startsWith(prefix)) {
    return <SupplierProductsPage supplierId={decodeURIComponent(pathname.slice(prefix.length))} />;
  }
  return <SupplierDirectory />;
}

function SupplierDirectory() {
  const { state } = useInventory();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const suppliers = useMemo(
    () => state.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, "zh")),
    [state.suppliers],
  );
  const offerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const offer of state.supplierProducts) {
      counts.set(offer.supplierId, (counts.get(offer.supplierId) ?? 0) + 1);
    }
    return counts;
  }, [state.supplierProducts]);

  return (
    <div>
      <PageHeader title="供应商">
        这里维护供应商名称和联系方式。报价多的时候点「查看产品」分页看，不在卡片里铺开。货号、品名和未含 GST 价格仍写在物料上。
      </PageHeader>
      <StickyToolbar>
        <Button className="h-11 px-4" onClick={() => setEditing("new")}>
          新增供应商
        </Button>
      </StickyToolbar>
      {suppliers.length === 0 ? (
        <EmptyState title="还没有供应商">新增后，就可以在物料上记录他们的货号和价格，入库时也可以选他们。</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {suppliers.map((supplier) => {
            const count = offerCounts.get(supplier.id) ?? 0;
            return (
              <li key={supplier.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{supplier.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{supplier.contact || "未填联系方式"}</p>
                    {supplier.notes ? <p className="mt-1 text-sm">{supplier.notes}</p> : null}
                    <p className="mt-2 text-sm tabular-nums text-[#1c3144]">{formatCount(count)} 条报价</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="h-10 bg-white" onClick={() => setEditing(supplier)}>
                      编辑
                    </Button>
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "h-10 bg-white px-3")}
                    >
                      查看产品 / View products
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing ? (
        <SupplierDialog
          key={editing === "new" ? "new" : editing.id}
          supplier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

interface ProductRow {
  offer: SupplierProduct;
  material: Material | undefined;
  category: string;
  productName: string;
  haystack: string;
}

function SupplierProductsPage({ supplierId }: { supplierId: string }) {
  const { state } = useInventory();
  const supplier = state.suppliers.find((item) => item.id === supplierId);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const categories = useMemo(() => categorySelectOptions(state.categories), [state.categories]);
  const rows = useMemo(() => buildProductRows(state.categories, state.materials, state.supplierProducts, supplierId), [
    state.categories,
    state.materials,
    state.supplierProducts,
    supplierId,
  ]);
  const categoryIds = useMemo(
    () => (category === "all" ? null : descendantIds(state.categories, category)),
    [category, state.categories],
  );
  const q = query.trim().toLowerCase();
  const filterKey = `${q}|${category}`;
  const [seenKey, setSeenKey] = useState(filterKey);
  if (seenKey !== filterKey) {
    setSeenKey(filterKey);
    setPage(1);
  }
  const activePage = seenKey === filterKey ? page : 1;
  const filtered = useMemo(() => {
    return rows
      .filter((row) => {
        if (categoryIds && (!row.material || !categoryIds.has(row.material.categoryId))) return false;
        return q ? row.haystack.includes(q) : true;
      })
      .sort((a, b) => {
        const byName = a.productName.localeCompare(b.productName, "zh");
        if (byName !== 0) return byName;
        const byCode = a.offer.supplierCode.localeCompare(b.offer.supplierCode, "zh");
        if (byCode !== 0) return byCode;
        return a.offer.id.localeCompare(b.offer.id);
      });
  }, [categoryIds, q, rows]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (seenKey === filterKey && page > pageCount) setPage(pageCount);
  const current = Math.min(activePage, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  if (!supplier) {
    return (
      <div>
        <BackLink />
        <EmptyState title="找不到这个供应商">
          <Link href="/suppliers" className="text-[#1f5f78]">
            返回供应商
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1c3144]">{supplier.name}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {joinMeta([supplier.contact || "未填联系方式", supplier.notes])}
          </p>
          <p className="mt-1 text-sm tabular-nums text-[#1c3144]">{formatCount(rows.length)} 条报价</p>
        </div>
        <Button variant="outline" className="h-10 bg-white" onClick={() => setEditing(true)}>
          编辑
        </Button>
      </div>
      <StickySearch
        search={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索货号、品名或 SKU"
            className="h-11 w-full bg-white"
            aria-label="搜索供应商产品"
          />
        }
        filters={() => (
          <OptionSelect
            label="类别"
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: "全部类别" }, ...categories]}
          />
        )}
      />
      <p className="mb-3 text-xs text-muted-foreground">
        {filtered.length === 0
          ? `显示 0 / ${formatCount(rows.length)}`
          : `显示 ${formatCount(start + 1)}–${formatCount(start + visible.length)} / ${formatCount(filtered.length)}`}
      </p>
      {rows.length === 0 ? (
        <EmptyState title="这家供应商还没有报价">报价写在物料上。新增或编辑物料时可以填这家的货号和价格。</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="没有符合筛选的产品">
          <button
            type="button"
            className="text-[#1f5f78]"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            清除筛选
          </button>
        </EmptyState>
      ) : (
        <>
          <ProductTable rows={visible} />
          <ProductCards rows={visible} />
          <nav className="mt-4 flex flex-wrap items-center justify-center gap-3" aria-label="分页">
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-white"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              上一页 / Prev
            </Button>
            <p className="text-sm tabular-nums text-[#1c3144]">
              第 {current} / {pageCount} 页
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-white"
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              下一页 / Next
            </Button>
          </nav>
        </>
      )}
      {editing ? <SupplierDialog supplier={supplier} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/suppliers" className="mb-3 inline-block text-sm text-[#1f5f78]">
      返回供应商
    </Link>
  );
}

function ProductTable({ rows }: { rows: ProductRow[] }) {
  return (
    <div className="hidden rounded-xl bg-white ring-1 ring-foreground/10 lg:block">
      <Table aria-label="供应商产品" className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[16%]">货号 / Code</TableHead>
            <TableHead className="w-[40%]">品名 / Product</TableHead>
            <TableHead className="w-[28%]">类别 / Category</TableHead>
            <TableHead className="w-[16%]">未含 GST / ex GST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.offer.id}>
              <TableCell className="break-all whitespace-normal">{row.offer.supplierCode || "—"}</TableCell>
              <TableCell>
                <ProductName row={row} />
              </TableCell>
              <TableCell>{row.material ? row.category || "未分类" : "—"}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatAud(row.offer.priceExGst)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProductCards({ rows }: { rows: ProductRow[] }) {
  return (
    <ul className="grid gap-3 lg:hidden">
      {rows.map((row) => (
        <li key={row.offer.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
          <ProductName row={row} />
          <p className="mt-1 text-sm text-muted-foreground">
            {joinMeta([row.offer.supplierCode || "无货号", row.material ? row.category || "未分类" : "—"])}
          </p>
          <p className="mt-2 text-sm tabular-nums">{formatAud(row.offer.priceExGst)} 未含 GST</p>
        </li>
      ))}
    </ul>
  );
}

function ProductName({ row }: { row: ProductRow }) {
  const supplierName = row.offer.supplierProductName.trim();
  const alreadyShown = row.material ? row.productName.toLowerCase().includes(supplierName.toLowerCase()) : false;
  return (
    <div>
      <div className="font-medium">
        {row.material ? <BilingualName nameZh={row.material.nameZh} nameEn={row.material.nameEn} /> : "已缺失物料"}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {joinMeta([row.material?.sku, supplierName && !alreadyShown ? supplierName : ""])}
      </p>
    </div>
  );
}

function buildProductRows(
  categories: Category[],
  materials: Material[],
  offers: SupplierProduct[],
  supplierId: string,
): ProductRow[] {
  const materialsById = new Map(materials.map((material) => [material.id, material]));
  const paths = new Map(categories.map((category) => [category.id, categoryPath(categories, category.id)]));
  const rows: ProductRow[] = [];
  for (const offer of offers) {
    if (offer.supplierId !== supplierId) continue;
    const material = materialsById.get(offer.materialId);
    const productName = material ? bilingualLabel(material.nameZh, material.nameEn) : "";
    rows.push({
      offer,
      material,
      category: material ? paths.get(material.categoryId) ?? "" : "",
      productName,
      haystack: [
        offer.supplierCode,
        offer.supplierProductName,
        material?.sku ?? "",
        material?.nameZh ?? "",
        material?.nameEn ?? "",
        material ? specSearchText(material.specs) : "",
      ]
        .join(" ")
        .toLowerCase(),
    });
  }
  return rows;
}
