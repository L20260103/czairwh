import { useState } from "react";

import { MovementEditDialog } from "@/components/MovementEditDialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BilingualName } from "@/components/BilingualName";
import { formatMelbourneTime, joinMeta, locationText, movementTypeLabel } from "@/lib/format";
import { supplierName } from "@/lib/inventory/catalog";
import { formatQty } from "@/lib/inventory/inventory";
import type { DerivedMovement, Material, MovementType, Supplier } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { cn } from "@/lib/utils";

function typeColor(type: MovementType): string {
  switch (type) {
    case "receipt":
      return "text-[#1f6f86]";
    case "issue":
      return "text-[#9a4d16]";
    default:
      return "text-[#315c86]";
  }
}

/** 出库显示「−」，入库和退库显示「+」。 */
function signedQty(type: MovementType, quantity: number): string {
  const text = formatQty(quantity);
  return type === "issue" ? `−${text}` : `+${text}`;
}

/** 流水列表：大屏用表格，小屏用卡片。compact 用于总览页。 */
export function MovementList({
  rows,
  materials,
  suppliers = [],
  compact = false,
  editable = false,
}: {
  rows: DerivedMovement[];
  materials: Material[];
  suppliers?: Supplier[];
  compact?: boolean;
  /** 流水页可以改操作人、工单、领用、参考和备注。 */
  editable?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const editing = editable ? rows.find((row) => row.id === editingId) : undefined;
  const editingMaterial = editing ? materialById.get(editing.materialId) : undefined;
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-sm text-muted-foreground">没有符合条件的流水。</p>;
  }
  return (
    <>
      <div className="hidden lg:block">
        <Table aria-label="库存流水" className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className={compact ? "w-[18%]" : "w-[12%]"}>时间</TableHead>
              <TableHead className={compact ? "w-[10%]" : "w-[7%]"}>类型</TableHead>
              <TableHead className={compact ? "w-[34%]" : "w-[22%]"}>物料</TableHead>
              <TableHead className={compact ? "w-[16%]" : "w-[9%]"}>数量</TableHead>
              <TableHead className={compact ? "w-[22%]" : "w-[12%]"}>变动前 → 后</TableHead>
              {compact ? null : <TableHead className="w-[10%]">操作人</TableHead>}
              {compact ? null : <TableHead className="w-[14%]">工单 / 领用</TableHead>}
              {compact ? null : <TableHead className="w-[14%]">参考 / 备注</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const material = materialById.get(row.materialId);
              const unitLabel = material ? getUnit(material.unit).label : "";
              return (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">
                    <div>{formatMelbourneTime(row.at)}</div>
                    {editable ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-1 h-8 bg-white"
                        onClick={() => setEditingId(row.id)}
                        aria-label={`编辑 ${formatMelbourneTime(row.at)} 的流水`}
                      >
                        编辑
                      </Button>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className={cn("font-medium", typeColor(row.type))}>{movementTypeLabel(row.type)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {material ? <BilingualName nameZh={material.nameZh} nameEn={material.nameEn} /> : "已缺失物料"}
                    </div>
                    <div className="text-xs text-muted-foreground">{joinMeta([material?.sku, material ? locationText(material.location) : ""])}</div>
                    {row.locationCode ? <div className="text-xs text-muted-foreground">货位 {row.locationCode}</div> : null}
                  </TableCell>
                  <TableCell className={cn("font-medium whitespace-nowrap tabular-nums", typeColor(row.type))}>
                    {signedQty(row.type, row.quantity)} {unitLabel}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatQty(row.derivedBefore)} → {formatQty(row.derivedAfter)} {unitLabel}
                  </TableCell>
                  {compact ? null : (
                    <TableCell>
                      <div>{row.operator}</div>
                    </TableCell>
                  )}
                  {compact ? null : (
                    <TableCell>
                      <div>{row.jobNumber || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.recipient || "—"}</div>
                    </TableCell>
                  )}
                  {compact ? null : (
                    <TableCell>
                      <div>{[row.supplierId ? supplierName(suppliers, row.supplierId) : "", row.reference].filter(Boolean).join(" · ") || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.notes || "—"}</div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ul className="grid gap-3 lg:hidden">
        {rows.map((row) => {
          const material = materialById.get(row.materialId);
          const unitLabel = material ? getUnit(material.unit).label : "";
          return (
            <li key={row.id} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", typeColor(row.type))}>{movementTypeLabel(row.type)}</p>
                  <p className="mt-0.5 font-medium">
                    {material ? <BilingualName nameZh={material.nameZh} nameEn={material.nameEn} /> : "已缺失物料"}
                  </p>
                  <p className="text-xs text-muted-foreground">{joinMeta([material?.sku, material ? locationText(material.location) : ""])}</p>
                  {row.locationCode ? <p className="text-xs text-muted-foreground">货位 {row.locationCode}</p> : null}
                </div>
                <p className={cn("shrink-0 text-lg font-semibold whitespace-nowrap tabular-nums", typeColor(row.type))}>
                  {signedQty(row.type, row.quantity)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{unitLabel}</span>
                </p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">变动</dt>
                  <dd className="tabular-nums">
                    {formatQty(row.derivedBefore)} → {formatQty(row.derivedAfter)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">时间（墨尔本）</dt>
                  <dd>{formatMelbourneTime(row.at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">操作人</dt>
                  <dd>{row.operator}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">工单</dt>
                  <dd>{row.jobNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">领用人</dt>
                  <dd>{row.recipient || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">参考单号</dt>
                  <dd>{row.reference || "—"}</dd>
                </div>
              </dl>
              {row.supplierId ? <p className="mt-2 text-xs text-muted-foreground">供应商 {supplierName(suppliers, row.supplierId)}</p> : null}
              {row.notes ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{row.notes}</p> : null}
              {editable ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-10 w-full bg-white"
                  onClick={() => setEditingId(row.id)}
                  aria-label={`编辑 ${formatMelbourneTime(row.at)} 的流水`}
                >
                  编辑
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editing ? (
        <MovementEditDialog
          key={editing.id}
          movement={editing}
          material={editingMaterial}
          supplierLabel={editing.supplierId ? supplierName(suppliers, editing.supplierId) : ""}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </>
  );
}
