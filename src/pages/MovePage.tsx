import { useState } from "react";

import { PageHeader } from "@/components/common";
import { MovementForm } from "@/components/MovementForm";
import { MovementList } from "@/components/MovementList";
import { bilingualLabel } from "@/lib/format";
import { DUPLICATE_WINDOW_MS, movementsNewestFirst } from "@/lib/inventory/inventory";
import type { MovementType } from "@/lib/inventory/types";
import { Link, useSearchParams } from "@/lib/router";
import { useInventory } from "@/store/InventoryProvider";

function parseMovementType(value: string | null): MovementType {
  return value === "issue" || value === "return" || value === "receipt" ? value : "receipt";
}

/** 出入库（#/move?type=receipt|issue|return&material=…）。链接参数变了就整页重建表单。 */
export function MovePage() {
  const params = useSearchParams();
  const initialType = parseMovementType(params.get("type"));
  const initialMaterialId = params.get("material") ?? "";
  return (
    <MovePageContent
      key={`${initialType}:${initialMaterialId}`}
      initialType={initialType}
      initialMaterialId={initialMaterialId}
    />
  );
}

function MovePageContent({ initialType, initialMaterialId }: { initialType: MovementType; initialMaterialId: string }) {
  const { state } = useInventory();
  const [selectedMaterialId, setSelectedMaterialId] = useState(initialMaterialId);
  const unknownMaterial = !!initialMaterialId && !state.materials.some((m) => m.id === initialMaterialId);
  const recent = movementsNewestFirst(state)
    .filter((row) => (selectedMaterialId ? row.materialId === selectedMaterialId : true))
    .slice(0, 8);
  const selectedMaterial = state.materials.find((m) => m.id === selectedMaterialId);

  return (
    <div>
      <PageHeader title="出入库">
        库存只随流水变化。数量、物料和类型记错了不能改原记录，请再记一笔。操作人、工单、领用、参考和备注可以到流水页修改。{DUPLICATE_WINDOW_MS / 1000} 秒内完全相同的一笔会被拦住，避免连点记重。
      </PageHeader>
      <MovementForm
        initialType={initialType}
        initialMaterialId={initialMaterialId}
        unknownMaterial={unknownMaterial}
        onMaterialChange={setSelectedMaterialId}
      />
      <section className="mt-6 min-w-0 rounded-xl bg-white p-4 ring-1 ring-foreground/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 flex-1 break-words font-semibold text-[#1c3144]">
            {selectedMaterial ? `${bilingualLabel(selectedMaterial.nameZh, selectedMaterial.nameEn)} 的最近流水` : "最近流水"}
          </h2>
          <Link
            href={selectedMaterial ? `/history?material=${selectedMaterial.id}` : "/history"}
            className="text-sm text-[#1f5f78]"
          >
            在全部流水里看
          </Link>
        </div>
        <MovementList rows={recent} materials={state.materials} suppliers={state.suppliers} />
      </section>
    </div>
  );
}
