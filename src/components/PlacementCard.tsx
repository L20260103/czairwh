import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BilingualName } from "@/components/BilingualName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMelbourneTime, movementTypeLabel } from "@/lib/format";
import { defaultOperatorName } from "@/lib/inventory/catalog";
import {
  STOCKTAKE_ISSUE_REFERENCE,
  STOCKTAKE_RECEIPT_REFERENCE,
  formatQty,
  fromCents,
  onHandCents,
  parseQuantity,
  toCents,
} from "@/lib/inventory/inventory";
import type { MaterialPlacement } from "@/lib/inventory/locations";
import type { MovementType } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";
import { useLocations } from "@/store/LocationProvider";

type Panel = "edit" | "move" | "count" | "history" | null;

/** 格子里的一条物料：本位置数量、总库存，以及出库 / 入库 / 退库等操作。 */
export function PlacementCard({
  placement,
  onMovement,
}: {
  placement: MaterialPlacement;
  onMovement: (type: MovementType) => void;
}) {
  const { state, postMovement } = useInventory();
  const { placements, locations, updatePlacement, transferPlacement, removePlacement } = useLocations();
  const material = state.materials.find((item) => item.id === placement.materialId);
  const unit = material ? getUnit(material.unit) : null;
  const onHand = material ? fromCents(onHandCents(state, material.id)) : 0;
  const located = placements.reduce(
    (sum, item) => (item.materialId === placement.materialId ? sum + toCents(item.quantity) : sum),
    0,
  );
  const unplaced = toCents(onHand) - located;
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);

  function toggle(next: Panel) {
    setPanel((current) => (current === next ? null : next));
  }

  async function remove() {
    setBusy(true);
    const result = await removePlacement(placement.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已从 ${placement.locationCode} 移出`);
  }

  return (
    <li className="rounded-md bg-white/80 px-2 py-1.5">
      <div className="min-w-0">
        {material ? (
          <BilingualName nameZh={material.nameZh} nameEn={material.nameEn} className="text-sm font-medium text-[#1c3144]" />
        ) : (
          <p className="text-sm text-[#1c3144]">物料已不在目录里</p>
        )}
        <p className="text-xs text-muted-foreground">
          {material ? material.sku : placement.materialId}
          {unit ? ` · 库存 ${formatQty(onHand)} ${unit.label}` : ""}
        </p>
        <p className="text-xs font-medium text-[#1c3144]" data-testid="location-qty">
          本位置 {formatQty(placement.quantity)}
          {unit ? ` ${unit.label}` : ""}
        </p>
        {material && unplaced > 0 ? (
          <p className="text-xs text-[#8a4b16]">另有 {formatQty(fromCents(unplaced))} {unit?.label} 未定位</p>
        ) : null}
        {material && unplaced < 0 ? (
          <p className="text-xs text-[#8a4b16]">货位合计比库存多 {formatQty(fromCents(-unplaced))} {unit?.label}</p>
        ) : null}
        {placement.notes ? <p className="text-xs text-[#5d6e7c]">{placement.notes}</p> : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Tiny onClick={() => onMovement("issue")}>出库</Tiny>
        <Tiny onClick={() => onMovement("receipt")}>入库</Tiny>
        <Tiny onClick={() => onMovement("return")}>退库</Tiny>
        <Tiny pressed={panel === "count"} onClick={() => toggle("count")}>盘点</Tiny>
        <Tiny pressed={panel === "edit"} onClick={() => toggle("edit")}>编辑</Tiny>
        <Tiny pressed={panel === "move"} onClick={() => toggle("move")}>移到别处</Tiny>
        <Tiny pressed={panel === "history"} onClick={() => toggle("history")}>本位置记录</Tiny>
        <Tiny onClick={() => void remove()} disabled={busy}>移出</Tiny>
      </div>
      {panel === "edit" && material ? (
        <EditForm
          placement={placement}
          unitCode={material.unit}
          busy={busy}
          onClose={() => setPanel(null)}
          onSave={async (quantity, notes) => {
            setBusy(true);
            const result = await updatePlacement({
              materialId: placement.materialId,
              locationCode: placement.locationCode,
              quantity,
              notes,
            });
            setBusy(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(quantity > 0 ? "已改这个货位的数量" : `已从 ${placement.locationCode} 移出`);
            setPanel(null);
          }}
        />
      ) : null}
      {panel === "move" && material ? (
        <MoveForm
          placement={placement}
          unitCode={material.unit}
          codes={locations.map((location) => location.code).filter((code) => code !== placement.locationCode)}
          busy={busy}
          onClose={() => setPanel(null)}
          onSave={async (quantity, toCode) => {
            setBusy(true);
            const result = await transferPlacement({
              materialId: placement.materialId,
              fromCode: placement.locationCode,
              toCode,
              quantity,
            });
            setBusy(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(`已移到 ${toCode}`);
            setPanel(null);
          }}
        />
      ) : null}
      {panel === "count" && material ? (
        <CountForm
          placement={placement}
          unitCode={material.unit}
          operator={defaultOperatorName(state.employees)}
          busy={busy}
          onClose={() => setPanel(null)}
          onSave={async (counted) => {
            const diff = toCents(counted) - toCents(placement.quantity);
            if (diff === 0) {
              toast.success("数量没有变化");
              setPanel(null);
              return;
            }
            setBusy(true);
            const result = await postMovement({
              type: diff > 0 ? "receipt" : "issue",
              materialId: placement.materialId,
              quantity: formatQty(fromCents(Math.abs(diff))),
              operator: defaultOperatorName(state.employees),
              jobNumber: "",
              recipient: "",
              supplierId: "",
              reference: diff > 0 ? STOCKTAKE_RECEIPT_REFERENCE : STOCKTAKE_ISSUE_REFERENCE,
              notes: "",
              locationCode: placement.locationCode,
              stocktake: true,
              countedQuantity: counted,
            });
            setBusy(false);
            if (!result.ok) {
              toast.error(result.errors.form ?? result.errors.quantity ?? result.errors.reference ?? "没能盘点");
              return;
            }
            toast.success(diff > 0 ? "已按盘点入库" : "已按盘点出库");
            setPanel(null);
          }}
        />
      ) : null}
      {panel === "history" ? <HistoryList materialId={placement.materialId} locationCode={placement.locationCode} /> : null}
    </li>
  );
}

function Tiny({
  children,
  onClick,
  pressed,
  disabled,
}: {
  children: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="h-7 rounded-md bg-white px-1.5 text-[11px] font-medium text-[#1f5f78] ring-1 ring-[#d5dee6] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function EditForm({
  placement,
  unitCode,
  busy,
  onClose,
  onSave,
}: {
  placement: MaterialPlacement;
  unitCode: string;
  busy: boolean;
  onClose: () => void;
  onSave: (quantity: number, notes: string) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(formatQty(placement.quantity));
  const [notes, setNotes] = useState(placement.notes);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseQuantity(quantity, unitCode, "count");
        if (!parsed.ok) {
          setError(parsed.error);
          return;
        }
        setError(null);
        void onSave(parsed.value, notes);
      }}
    >
      <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="本位置数量" className="h-9 bg-white tabular-nums" inputMode="decimal" />
      <Input value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="货位备注" placeholder="备注（选填）" maxLength={80} className="h-9 bg-white" />
      <p className="text-[11px] text-muted-foreground">只改这个格子的记录，不写流水。填 0 会移出。</p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" className="h-8 px-3" disabled={busy}>保存</Button>
        <Button type="button" variant="outline" className="h-8 bg-white" onClick={onClose}>取消</Button>
      </div>
    </form>
  );
}

function MoveForm({
  placement,
  unitCode,
  codes,
  busy,
  onClose,
  onSave,
}: {
  placement: MaterialPlacement;
  unitCode: string;
  codes: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (quantity: number, toCode: string) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(formatQty(placement.quantity));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return codes.filter((code) => !needle || code.toLowerCase().includes(needle)).slice(0, 8);
  }, [codes, query]);
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseQuantity(quantity, unitCode, "movement");
        if (!parsed.ok) {
          setError(parsed.error);
          return;
        }
        if (toCents(parsed.value) > toCents(placement.quantity)) {
          setError(`本位置只有 ${formatQty(placement.quantity)}。`);
          return;
        }
        const toCode = query.trim();
        if (!codes.includes(toCode)) {
          setError("请从列表里选一个货位。");
          return;
        }
        setError(null);
        void onSave(parsed.value, toCode);
      }}
    >
      <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="移动数量" className="h-9 bg-white tabular-nums" inputMode="decimal" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="目标货位" placeholder="目标货位，例如 C2-3" className="h-9 bg-white" />
      <ul className="grid gap-1">
        {matches.map((code) => (
          <li key={code}>
            <button type="button" className="w-full rounded-md bg-white px-2 py-1 text-left text-xs ring-1 ring-[#d5dee6]" onClick={() => setQuery(code)}>
              {code}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">只换格子，不改总库存。</p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" className="h-8 px-3" disabled={busy}>移动</Button>
        <Button type="button" variant="outline" className="h-8 bg-white" onClick={onClose}>取消</Button>
      </div>
    </form>
  );
}

function CountForm({
  placement,
  unitCode,
  operator,
  busy,
  onClose,
  onSave,
}: {
  placement: MaterialPlacement;
  unitCode: string;
  operator: string;
  busy: boolean;
  onClose: () => void;
  onSave: (counted: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(formatQty(placement.quantity));
  const [error, setError] = useState<string | null>(null);
  const unit = getUnit(unitCode);
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseQuantity(quantity, unitCode, "count");
        if (!parsed.ok) {
          setError(parsed.error);
          return;
        }
        setError(null);
        void onSave(parsed.value);
      }}
    >
      <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="盘点数量" className="h-9 bg-white tabular-nums" inputMode="decimal" />
      <p className="text-[11px] leading-4 text-muted-foreground">
        和本位置 {formatQty(placement.quantity)} {unit.label} 不一样时，多的记盘点入库，少的记盘点出库。操作人 {operator}，不用领用人。
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" className="h-8 px-3" disabled={busy}>确认盘点</Button>
        <Button type="button" variant="outline" className="h-8 bg-white" onClick={onClose}>取消</Button>
      </div>
    </form>
  );
}

function HistoryList({ materialId, locationCode }: { materialId: string; locationCode: string }) {
  const { state } = useInventory();
  const material = state.materials.find((item) => item.id === materialId);
  const unit = material ? getUnit(material.unit).label : "";
  const rows = state.movements
    .filter((movement) => movement.materialId === materialId && movement.locationCode === locationCode)
    .slice()
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
    .slice(0, 6);
  if (rows.length === 0) return <p className="mt-2 text-xs text-muted-foreground">这个货位还没有流水。</p>;
  return (
    <ul className="mt-2 grid gap-1">
      {rows.map((row) => (
        <li key={row.id} className="text-xs text-[#1c3144]">
          <span className="text-muted-foreground">{formatMelbourneTime(row.at)}</span> {movementTypeLabel(row.type)}{" "}
          {row.type === "issue" ? "−" : "+"}
          {formatQty(row.quantity)} {unit}
          {row.reference ? ` · ${row.reference}` : ""}
        </li>
      ))}
    </ul>
  );
}
