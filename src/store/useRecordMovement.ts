import { useRef, useState } from "react";
import { toast } from "sonner";

import { postedMovementSummary } from "@/lib/format";
import type { Movement, MovementDraft, MovementErrors } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

type RecordResult = { ok: true; movement: Movement } | { ok: false; errors: MovementErrors };

/**
 * 出入库页和目录上的入库 / 出库 / 退库共用这一条。
 * 正数数量、出库为负的库存影响、before_qty / after_qty、类型值都在 postMovement 里算好再写入。
 * 这里只负责防连点和成功 / 失败提示，不再写第二套流水。
 */
export function useRecordMovement() {
  const { postMovement } = useInventory();
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  async function record(draft: MovementDraft): Promise<RecordResult | null> {
    if (lock.current) return null;
    lock.current = true;
    setSubmitting(true);
    try {
      const result = await postMovement(draft);
      if (!result.ok) {
        const message =
          result.errors.form ??
          result.errors.quantity ??
          result.errors.jobNumber ??
          result.errors.materialId ??
          result.errors.operator ??
          result.errors.recipient ??
          result.errors.supplierId ??
          "没能记账";
        toast.error(message);
        return result;
      }
      toast.success(postedMovementSummary(result.movement));
      return result;
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  return { record, submitting };
}
