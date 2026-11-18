import { useState } from "react";

import { EmptyState, PageHeader } from "@/components/common";
import { SupplierDialog } from "@/components/SupplierDialog";
import { Button } from "@/components/ui/button";
import { bilingualLabel, formatAud } from "@/lib/format";
import type { Supplier } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

/** 供应商（#/suppliers）。 */
export function SuppliersPage() {
  const { state } = useInventory();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const suppliers = state.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, "zh"));

  return (
    <div>
      <PageHeader title="供应商">
        这里维护供应商名称和联系方式。同一件物料在不同供应商处的货号、品名和未含 GST 价格，写在物料里。
      </PageHeader>
      <div className="mb-4">
        <Button className="h-11 px-4" onClick={() => setEditing("new")}>
          新增供应商
        </Button>
      </div>
      {suppliers.length === 0 ? (
        <EmptyState title="还没有供应商">新增后，就可以在物料上记录他们的货号和价格，入库时也可以选他们。</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {suppliers.map((supplier) => {
            const offers = state.supplierProducts.filter((offer) => offer.supplierId === supplier.id);
            return (
              <li key={supplier.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{supplier.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{supplier.contact || "未填联系方式"}</p>
                    {supplier.notes ? <p className="mt-1 text-sm">{supplier.notes}</p> : null}
                    <p className="mt-2 text-xs text-muted-foreground">{offers.length} 条报价</p>
                  </div>
                  <Button variant="outline" className="h-10 bg-white" onClick={() => setEditing(supplier)}>
                    编辑
                  </Button>
                </div>
                {offers.length > 0 ? (
                  <ul className="mt-3 grid gap-1 text-sm">
                    {offers.map((offer) => {
                      const material = state.materials.find((item) => item.id === offer.materialId);
                      return (
                        <li key={offer.id} className="text-muted-foreground">
                          {material ? bilingualLabel(material.nameZh, material.nameEn) : "已缺失物料"}
                          {offer.supplierCode ? ` · ${offer.supplierCode}` : ""} · {offer.supplierProductName} · {formatAud(offer.priceExGst)} 未含 GST
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
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
