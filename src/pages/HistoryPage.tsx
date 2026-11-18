import { useMemo, useState } from "react";

import { PageHeader } from "@/components/common";
import { MovementList } from "@/components/MovementList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { movementsNewestFirst } from "@/lib/inventory/inventory";
import type { MovementType } from "@/lib/inventory/types";
import { useSearchParams } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useInventory } from "@/store/InventoryProvider";

type TypeFilter = "all" | MovementType;

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "receipt", label: "入库" },
  { id: "issue", label: "出库" },
  { id: "return", label: "退库" },
];

/** 流水（#/history?q=&job=&material=&type=）。 */
export function HistoryPage() {
  const params = useSearchParams();
  const { state } = useInventory();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [job, setJob] = useState(params.get("job") ?? "");
  const [materialId, setMaterialId] = useState(params.get("material") ?? "");
  const initialType = params.get("type");
  const [type, setType] = useState<TypeFilter>(
    initialType === "receipt" || initialType === "issue" || initialType === "return" ? initialType : "all",
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const jobQuery = job.trim().toLowerCase();
    const materialById = new Map(state.materials.map((m) => [m.id, m]));
    return movementsNewestFirst(state).filter((row) => {
      if (
        (type !== "all" && row.type !== type) ||
        (materialId && row.materialId !== materialId) ||
        (jobQuery && !row.jobNumber.toLowerCase().includes(jobQuery))
      )
        return false;
      if (!q) return true;
      const material = materialById.get(row.materialId);
      return [
        material?.sku,
        material?.name,
        material?.category,
        row.operator,
        row.jobNumber,
        row.recipient,
        row.reference,
        row.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [job, materialId, query, state, type]);

  const selectedMaterial = state.materials.find((m) => m.id === materialId);

  return (
    <div>
      <PageHeader title="流水">
        按墨尔本时间显示。变动前和变动后按流水顺序重算，所以和现存数量对得上。示例行的操作人、工单和供应商名称里带有「示例」。
      </PageHeader>
      <div className="mb-4 grid gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索 SKU、名称、工单、操作人、备注"
          className="h-11 bg-white"
          aria-label="搜索流水"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={job}
            onChange={(event) => setJob(event.target.value)}
            placeholder="按工单号筛选"
            className="h-11 bg-white sm:max-w-xs"
            aria-label="按工单号筛选"
          />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="流水类型">
            {TYPE_FILTERS.map((filter) => (
              <Button
                key={filter.id}
                type="button"
                variant={type === filter.id ? "default" : "outline"}
                className={cn("h-11", type !== filter.id && "bg-white")}
                aria-checked={type === filter.id}
                role="radio"
                onClick={() => setType(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
        {selectedMaterial ? (
          <p className="text-sm text-muted-foreground">
            正在只看 {selectedMaterial.name}（{selectedMaterial.sku}）。
            <button type="button" className="ml-2 text-[#1f5f78]" onClick={() => setMaterialId("")}>
              看全部物料
            </button>
          </p>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">显示 {rows.length} 笔</p>
      <div className="rounded-xl bg-white p-3 ring-1 ring-foreground/10 sm:p-4">
        <MovementList rows={rows} materials={state.materials} />
      </div>
    </div>
  );
}
