import { useState } from "react";
import { toast } from "sonner";

import { BilingualName } from "@/components/BilingualName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cellAt, columnKeys, levelsDescending, type MaterialPlacement, type StorageLocation } from "@/lib/inventory/locations";
import { materialMatchesQuery } from "@/lib/inventory/locations";
import { formatQty, fromCents, onHandCentsByMaterial } from "@/lib/inventory/inventory";
import type { Material } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { cn } from "@/lib/utils";
import { useLocations } from "@/store/LocationProvider";
import { useInventory } from "@/store/InventoryProvider";

export function BaySheet({
  bay,
  locations,
  placements,
  highlighted,
  activeCode,
  desktop,
  onClose,
}: {
  bay: string;
  locations: StorageLocation[];
  placements: MaterialPlacement[];
  highlighted: Set<string> | null;
  activeCode: string | null;
  desktop: boolean;
  onClose: () => void;
}) {
  const cells = locations.filter((location) => location.bay === bay).sort((a, b) => a.sort - b.sort);
  const zone = cells[0]?.zone ?? "";
  const shelf = bay.startsWith("S");
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const byCode = new Map<string, MaterialPlacement[]>();
  for (const placement of placements) {
    const list = byCode.get(placement.locationCode);
    if (list) list.push(placement);
    else byCode.set(placement.locationCode, [placement]);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        data-testid="bay-sheet"
        data-bay={bay}
        className={cn("gap-0 overflow-hidden bg-white p-0", desktop ? "sm:max-w-none" : "rounded-t-2xl")}
        style={desktop ? { width: "min(34rem, 100vw)" } : { maxHeight: "85dvh" }}
      >
        <SheetHeader className="border-b border-[#d5dee6] pr-12">
          <SheetTitle>{shelf ? bay : `${bay}格`}</SheetTitle>
          <SheetDescription>
            {zone}
            {zone ? " · " : ""}
            正面，上层在上
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {cells.length === 0 ? (
            <p className="text-sm text-muted-foreground">这个货架没有货位数据。</p>
          ) : (
            <FrontView
              cells={cells}
              byCode={byCode}
              highlighted={highlighted}
              activeCode={activeCode}
              addingCode={addingCode}
              onAdding={setAddingCode}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FrontView({
  cells,
  byCode,
  highlighted,
  activeCode,
  addingCode,
  onAdding,
}: {
  cells: StorageLocation[];
  byCode: Map<string, MaterialPlacement[]>;
  highlighted: Set<string> | null;
  activeCode: string | null;
  addingCode: string | null;
  onAdding: (code: string | null) => void;
}) {
  const cols = columnKeys(cells);
  const levels = levelsDescending(cells);
  const single = cols.length === 1 && cols[0] == null;

  if (single) {
    return (
      <div className="grid gap-3">
        {levels.map((level) => {
          const cell = cellAt(cells, null, level);
          if (!cell) return null;
          return (
            <div key={cell.code}>
              <p className="mb-1 text-xs text-muted-foreground">第{level}层</p>
              <LocationCell
                cell={cell}
                items={byCode.get(cell.code) ?? []}
                highlighted={highlighted?.has(cell.code) ?? false}
                active={cell.code === activeCode}
                adding={addingCode === cell.code}
                onAdding={onAdding}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}>
      <div />
      {cols.map((col) => (
        <div key={String(col)} className="pb-1 text-center text-xs text-muted-foreground">
          {col == null ? "" : `第${col}列`}
        </div>
      ))}
      {levels.map((level) => (
        <LevelRow key={level} level={level} cols={cols} cells={cells} byCode={byCode} highlighted={highlighted} activeCode={activeCode} addingCode={addingCode} onAdding={onAdding} />
      ))}
    </div>
  );
}

function LevelRow({
  level,
  cols,
  cells,
  byCode,
  highlighted,
  activeCode,
  addingCode,
  onAdding,
}: {
  level: number;
  cols: Array<number | null>;
  cells: StorageLocation[];
  byCode: Map<string, MaterialPlacement[]>;
  highlighted: Set<string> | null;
  activeCode: string | null;
  addingCode: string | null;
  onAdding: (code: string | null) => void;
}) {
  return (
    <>
      <div className="pt-2 text-xs whitespace-nowrap text-muted-foreground">第{level}层</div>
      {cols.map((col) => {
        const cell = cellAt(cells, col, level);
        if (!cell) return <div key={`${col}-${level}`} />;
        return (
          <LocationCell
            key={cell.code}
            cell={cell}
            items={byCode.get(cell.code) ?? []}
            highlighted={highlighted?.has(cell.code) ?? false}
            active={cell.code === activeCode}
            adding={addingCode === cell.code}
            onAdding={onAdding}
          />
        );
      })}
    </>
  );
}

function LocationCell({
  cell,
  items,
  highlighted,
  active,
  adding,
  onAdding,
}: {
  cell: StorageLocation;
  items: MaterialPlacement[];
  highlighted: boolean;
  active: boolean;
  adding: boolean;
  onAdding: (code: string | null) => void;
}) {
  const { state } = useInventory();
  const { removePlacement } = useLocations();
  const onHand = onHandCentsByMaterial(state);
  const filled = items.length > 0;
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(id: string) {
    setRemoving(id);
    const result = await removePlacement(id);
    setRemoving(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已从 ${cell.code} 移出`);
  }

  return (
    <div
      data-testid="location-cell"
      data-location-cell={cell.code}
      className={cn(
        "min-w-0 rounded-lg border p-2",
        filled ? "border-[#e2b48a] bg-[#f8eadb]" : "border-[#d5dee6] bg-white",
        active ? "ring-2 ring-[#143044]" : highlighted ? "ring-2 ring-[#1f5f78]" : "",
      )}
    >
      <p className="font-semibold text-[#1c3144]">{cell.code}</p>
      {items.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">空</p> : null}
      <ul className="mt-1 grid gap-1.5">
        {items.map((item) => {
          const material = state.materials.find((entry) => entry.id === item.materialId);
          const cents = onHand.get(item.materialId) ?? 0;
          return (
            <li key={item.id} className="rounded-md bg-white/80 px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {material ? (
                    <BilingualName nameZh={material.nameZh} nameEn={material.nameEn} className="text-sm font-medium text-[#1c3144]" />
                  ) : (
                    <p className="text-sm text-[#1c3144]">物料已不在目录里</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {material ? `${material.sku} · ${formatQty(fromCents(cents))} ${getUnit(material.unit).label}` : item.materialId}
                  </p>
                  {item.notes ? <p className="text-xs text-[#5d6e7c]">{item.notes}</p> : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-[#9a3412] disabled:opacity-50"
                  disabled={removing === item.id}
                  onClick={() => void remove(item.id)}
                >
                  移出
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <MaterialPicker
          locationCode={cell.code}
          excludeIds={new Set(items.map((item) => item.materialId))}
          onCancel={() => onAdding(null)}
          onAdded={() => onAdding(null)}
        />
      ) : (
        <button type="button" className="mt-2 text-xs font-medium text-[#1f5f78]" onClick={() => onAdding(cell.code)}>
          放入物料
        </button>
      )}
    </div>
  );
}

function MaterialPicker({
  locationCode,
  excludeIds,
  onCancel,
  onAdded,
}: {
  locationCode: string;
  excludeIds: Set<string>;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const { state } = useInventory();
  const { addPlacement } = useLocations();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const needle = query.trim();
  const matches: Material[] = [];
  let more = false;
  if (needle) {
    for (const material of state.materials) {
      if (excludeIds.has(material.id) || !materialMatchesQuery(material, needle)) continue;
      if (matches.length >= 8) {
        more = true;
        break;
      }
      matches.push(material);
    }
  }
  const onHand = onHandCentsByMaterial(state);

  async function add(materialId: string) {
    setBusy(true);
    const result = await addPlacement({ materialId, locationCode, notes: note });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已放入 ${locationCode}`);
    onAdded();
  }

  return (
    <div className="mt-2 grid gap-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="名称或 SKU"
        aria-label={`在 ${locationCode} 搜索物料`}
        className="h-10 bg-white"
        autoFocus
      />
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="备注（选填）"
        aria-label="货位备注"
        maxLength={80}
        className="h-10 bg-white"
      />
      {needle && matches.length === 0 ? <p className="text-xs text-muted-foreground">没有匹配的物料。</p> : null}
      <ul className="grid gap-1">
        {matches.map((material) => (
          <li key={material.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void add(material.id)}
              className="w-full rounded-md bg-white px-2 py-1.5 text-left ring-1 ring-[#d5dee6] hover:ring-[#1f5f78] disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-[#1c3144]">
                {material.nameZh || material.nameEn}
                {material.active ? "" : " · 已停用"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {material.sku}
                {material.nameEn && material.nameZh ? ` · ${material.nameEn}` : ""} · {formatQty(fromCents(onHand.get(material.id) ?? 0))}{" "}
                {getUnit(material.unit).label}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more ? <p className="text-xs text-muted-foreground">还有更多，请再缩小一点。</p> : null}
      <Button type="button" variant="outline" className="h-9 bg-white" onClick={onCancel}>
        取消
      </Button>
    </div>
  );
}
