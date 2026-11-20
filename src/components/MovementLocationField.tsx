import { useEffect, useMemo } from "react";

import { FormField } from "@/components/common";
import { OptionSelect } from "@/components/OptionSelect";
import { formatQty } from "@/lib/inventory/inventory";
import type { MovementType } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";
import { useLocations } from "@/store/LocationProvider";

/** 出入库表单上的可选货位。出库只列出这个物料已经放过的格子。 */
export function MovementLocationField({
  id,
  type,
  materialId,
  value,
  onChange,
}: {
  id: string;
  type: MovementType;
  materialId: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const { state } = useInventory();
  const { ready, locations, placements } = useLocations();
  const material = state.materials.find((item) => item.id === materialId);
  const unit = material ? getUnit(material.unit).label : "";

  const options = useMemo(() => {
    if (type === "issue") {
      return placements
        .filter((placement) => placement.materialId === materialId && placement.quantity > 0)
        .slice()
        .sort((a, b) => a.locationCode.localeCompare(b.locationCode))
        .map((placement) => ({
          value: placement.locationCode,
          label: `${placement.locationCode} · 本位置 ${formatQty(placement.quantity)}${unit ? ` ${unit}` : ""}`,
        }));
    }
    return locations
      .slice()
      .sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code))
      .map((location) => ({ value: location.code, label: location.code }));
  }, [locations, materialId, placements, type, unit]);

  useEffect(() => {
    if (!value) return;
    if (!options.some((option) => option.value === value)) onChange("");
  }, [onChange, options, value]);

  return (
    <FormField
      label="货位（可选）"
      htmlFor={id}
      hint={
        type === "issue"
          ? "只列出已经放着这个物料的货位。不选的话，只减总库存。"
          : "可以记到某个货位。不选的话，只改总库存。"
      }
    >
      <OptionSelect
        id={id}
        label="货位"
        value={value || "none"}
        onChange={(next) => onChange(next === "none" ? "" : next)}
        options={[
          { value: "none", label: ready ? "不指定货位" : "货位读取中" },
          ...options,
        ]}
      />
    </FormField>
  );
}
