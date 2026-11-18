import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common";
import { EmployeeNameSelect } from "@/components/EmployeeNameSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bilingualLabel, formatMelbourneTime, locationText, movementTypeLabel } from "@/lib/format";
import { formatQty, MAX_LENGTH } from "@/lib/inventory/inventory";
import type { DerivedMovement, Material, MovementTextErrors } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";

/** 只改一笔流水的文字。数量、物料、类型、时间和变动前后保持只读。 */
export function MovementEditDialog({
  movement,
  material,
  supplierLabel,
  onClose,
}: {
  movement: DerivedMovement;
  material?: Material;
  supplierLabel: string;
  onClose: () => void;
}) {
  const { state, saveMovementText } = useInventory();
  const [operator, setOperator] = useState(movement.operator);
  const [jobNumber, setJobNumber] = useState(movement.jobNumber);
  const [recipient, setRecipient] = useState(movement.recipient);
  const [reference, setReference] = useState(movement.reference);
  const [notes, setNotes] = useState(movement.notes);
  const [errors, setErrors] = useState<MovementTextErrors>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const receipt = movement.type === "receipt";
  const unitLabel = material ? getUnit(material.unit).label : "";
  const signed = movement.type === "issue" ? `−${formatQty(movement.quantity)}` : `+${formatQty(movement.quantity)}`;
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || saving) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await saveMovementText(movement.id, { operator, jobNumber, recipient, reference, notes });
      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.errors.form ?? "请先改掉标红的字段");
        return;
      }
      toast.success("流水已更新");
      onClose();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" style={{ maxWidth: "32rem" }}>
        <DialogHeader>
          <DialogTitle>编辑流水 / Edit movement</DialogTitle>
          <DialogDescription>
            只能改操作人、工单号、领用人、参考单号和备注（operator, job, recipient, reference, notes）。数量、物料、类型、时间和变动前后不能改。库存仍是全部流水相加。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-[#f4f7f9] p-2.5 text-xs" data-locked-fields="true">
            <div>
              <dt className="text-muted-foreground">时间 / Time</dt>
              <dd>{formatMelbourneTime(movement.at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">类型 / Type</dt>
              <dd>{movementTypeLabel(movement.type)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">物料 / Material</dt>
              <dd>{material ? `${bilingualLabel(material.nameZh, material.nameEn)} · ${material.sku}` : "已缺失物料"}</dd>
              {material ? <dd className="text-muted-foreground">{locationText(material.location) || "库位未填"}</dd> : null}
            </div>
            <div>
              <dt className="text-muted-foreground">数量 / Quantity</dt>
              <dd className="tabular-nums">
                {signed} {unitLabel}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">变动前 → 后 / Before → after</dt>
              <dd className="tabular-nums">
                {formatQty(movement.derivedBefore)} → {formatQty(movement.derivedAfter)} {unitLabel}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">供应商 / Supplier</dt>
              <dd>{supplierLabel || "—"}</dd>
            </div>
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="操作人 / Operator"
              htmlFor="movement-edit-operator"
              error={errors.operator}
              hint={`从在职员工里选。必填，最多 ${MAX_LENGTH.operator} 个字。不在名单上的当前值会保留。`}
            >
              <EmployeeNameSelect
                id="movement-edit-operator"
                label="操作人"
                value={operator}
                onChange={setOperator}
                employees={state.employees}
                placeholder="选择操作人"
                invalid={!!errors.operator}
              />
            </FormField>

            <FormField
              label="工单号 / Job"
              htmlFor="movement-edit-job"
              error={errors.jobNumber}
              hint={receipt ? "入库不记工单号，不能改。" : `出库和退库必填，最多 ${MAX_LENGTH.job} 个字。`}
            >
              <Input
                id="movement-edit-job"
                value={receipt ? "" : jobNumber}
                onChange={(event) => setJobNumber(event.target.value)}
                placeholder={receipt ? "入库无工单" : "例如 CZ-JOB-2401"}
                className="h-11"
                autoComplete="off"
                readOnly={receipt}
                disabled={receipt}
                aria-invalid={!!errors.jobNumber}
                data-editable={receipt ? "false" : "true"}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="领用人 / Recipient"
              htmlFor="movement-edit-recipient"
              error={errors.recipient}
              hint={
                receipt
                  ? "入库不记领用人，不能改。"
                  : movement.type === "issue"
                    ? `出库必填，最多 ${MAX_LENGTH.recipient} 个字。`
                    : `退库可以不填，最多 ${MAX_LENGTH.recipient} 个字。`
              }
            >
              {receipt ? (
                <Input
                  id="movement-edit-recipient"
                  value=""
                  placeholder="入库无领用人"
                  className="h-11"
                  readOnly
                  disabled
                  data-editable="false"
                />
              ) : (
                <EmployeeNameSelect
                  id="movement-edit-recipient"
                  label="领用人"
                  value={recipient}
                  onChange={setRecipient}
                  employees={state.employees}
                  allowEmpty={movement.type === "return"}
                  placeholder={movement.type === "return" ? "可以不填" : "谁拿走这批料"}
                  invalid={!!errors.recipient}
                />
              )}
            </FormField>

            <FormField
              label="参考单号 / Reference"
              htmlFor="movement-edit-reference"
              error={errors.reference}
              hint={`可选，最多 ${MAX_LENGTH.reference} 个字。供应商显示在上面，这里不改。`}
            >
              <Input
                id="movement-edit-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="例如送货单 DN-1102"
                className="h-11"
                autoComplete="off"
                aria-invalid={!!errors.reference}
                data-editable="true"
              />
            </FormField>
          </div>

          <FormField label="备注 / Notes" htmlFor="movement-edit-notes" error={errors.notes} hint={`可选，最多 ${MAX_LENGTH.notes} 个字。`}>
            <Textarea
              id="movement-edit-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="例如补上当时没写的说明"
              className="min-h-16"
              aria-invalid={!!errors.notes}
              data-editable="true"
            />
          </FormField>

          {errors.form ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.form}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
