import { useMemo, useState, type FormEvent } from "react";

import { FormField } from "@/components/common";
import { EmployeeNameSelect } from "@/components/EmployeeNameSelect";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BilingualName } from "@/components/BilingualName";
import { bilingualLabel, formatAud, movementTypeLabel } from "@/lib/format";
import { defaultOperatorName, preferredSupplierId } from "@/lib/inventory/catalog";
import { formatQty, getJobBalance, getOnHand, validateMovement } from "@/lib/inventory/inventory";
import type { Material, MovementDraft, MovementErrors, MovementType } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";
import { useRecordMovement } from "@/store/useRecordMovement";

/** 目录里直接记账。物料已经定好，流水仍走和出入库页相同的 postMovement。 */
export function CatalogueMovementDialog({
  material,
  type,
  onClose,
  onRecorded,
}: {
  material: Material;
  type: MovementType;
  onClose: () => void;
  onRecorded: (materialId: string) => void;
}) {
  const { state } = useInventory();
  const { record, submitting } = useRecordMovement();
  const [quantity, setQuantity] = useState("");
  const [operator, setOperator] = useState(() => defaultOperatorName(state.employees, state.lastOperator));
  const [jobNumber, setJobNumber] = useState("");
  const [recipient, setRecipient] = useState("");
  const [supplierId, setSupplierId] = useState(() => {
    if (type !== "receipt") return "none";
    const preferred = preferredSupplierId(state.supplierProducts, material.id);
    return state.suppliers.some((supplier) => supplier.id === preferred) ? preferred : "none";
  });
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const draft: MovementDraft = {
    type,
    materialId: material.id,
    quantity,
    operator,
    jobNumber,
    recipient,
    supplierId: supplierId === "none" ? "" : supplierId,
    reference,
    notes,
  };
  const validation = validateMovement(state, draft, new Date().toISOString());
  const errors: MovementErrors = validation.ok ? {} : validation.errors;
  const onHand = getOnHand(state, material.id);
  const unit = getUnit(material.unit);
  const jobBalance = jobNumber.trim() ? getJobBalance(state, material.id, jobNumber) : null;

  function fieldError(field: keyof MovementErrors, force = false): string | undefined {
    if (!submitted && !force) return undefined;
    return errors[field];
  }

  const supplierOptions = useMemo(() => {
    const suppliers = state.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, "zh"));
    return [
      { value: "none", label: suppliers.length === 0 ? "还没有供应商" : "不指定供应商" },
      ...suppliers.map((supplier) => {
        const offer = state.supplierProducts
          .filter((item) => item.supplierId === supplier.id && item.materialId === material.id)
          .sort((a, b) => a.priceExGst - b.priceExGst)[0];
        const label = offer
          ? `${supplier.name}${offer.supplierCode ? ` · ${offer.supplierCode}` : ""} · ${formatAud(offer.priceExGst)}`
          : supplier.name;
        return { value: supplier.id, label };
      }),
    ];
  }, [material.id, state.supplierProducts, state.suppliers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (submitting) return;
    if (!validation.ok) {
      setSubmitError(errors.form ?? errors.quantity ?? errors.jobNumber ?? errors.operator ?? errors.recipient ?? null);
      return;
    }
    const result = await record(draft);
    if (!result) return;
    if (!result.ok) {
      setSubmitError(result.errors.form ?? result.errors.quantity ?? result.errors.jobNumber ?? null);
      return;
    }
    onRecorded(material.id);
    onClose();
  }

  const title = movementTypeLabel(type);
  const submitLabel = type === "receipt" ? "确认入库" : type === "issue" ? "确认出库" : "确认退库";
  const banner = fieldError("form") || submitError || (submitted ? fieldError("quantity") || fieldError("jobNumber") : undefined);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        style={{ maxWidth: "32rem" }}
        data-testid="catalogue-movement-dialog"
        data-movement-type={type}
        data-material-id={material.id}
        data-material-name={bilingualLabel(material.nameZh, material.nameEn)}
      >
        <DialogHeader>
          <DialogTitle>
            {title}
            <BilingualName nameZh={material.nameZh} nameEn={material.nameEn} className="mt-1 block font-normal" />
          </DialogTitle>
          <DialogDescription>
            {material.sku} · 当前库存 {formatQty(onHand)} {unit.label}。记入和出入库页同一本流水，出库不能超过当前库存。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <FormField
            label="数量"
            htmlFor="catalogue-quantity"
            error={fieldError("quantity", quantity.trim().length > 0)}
            hint={`单位「${unit.label}」${unit.integer ? "只接受整数" : "最多两位小数"}。不能为 0 或负数。`}
          >
            <Input
              id="catalogue-quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={unit.integer ? "例如 2" : "例如 2.5"}
              className="h-11 tabular-nums"
              autoComplete="off"
              aria-invalid={!!fieldError("quantity", quantity.trim().length > 0)}
            />
          </FormField>

          {type !== "receipt" ? (
            <FormField label="工单号" htmlFor="catalogue-job" error={fieldError("jobNumber", jobNumber.trim().length > 0)}>
              <Input
                id="catalogue-job"
                value={jobNumber}
                onChange={(event) => setJobNumber(event.target.value)}
                placeholder="例如 CZ-JOB-2401"
                className="h-11"
                autoComplete="off"
                aria-invalid={!!fieldError("jobNumber", jobNumber.trim().length > 0)}
              />
            </FormField>
          ) : null}

          {type === "issue" ? (
            <FormField label="领用人" htmlFor="catalogue-recipient" error={fieldError("recipient")}>
              <EmployeeNameSelect
                id="catalogue-recipient"
                label="领用人"
                value={recipient}
                onChange={setRecipient}
                employees={state.employees}
                placeholder="谁拿走这批料"
                invalid={!!fieldError("recipient")}
              />
            </FormField>
          ) : null}

          {type === "return" ? (
            <FormField label="退回人（可选）" htmlFor="catalogue-recipient" error={fieldError("recipient")}>
              <EmployeeNameSelect
                id="catalogue-recipient"
                label="退回人"
                value={recipient}
                onChange={setRecipient}
                employees={state.employees}
                allowEmpty
                placeholder="可以不填"
                invalid={!!fieldError("recipient")}
              />
            </FormField>
          ) : null}

          {type === "receipt" ? (
            <FormField label="供应商" htmlFor="catalogue-supplier" error={fieldError("supplierId")} hint="有报价时会先选最低的那一家，可以改。">
              <OptionSelect
                id="catalogue-supplier"
                label="供应商"
                value={supplierId}
                onChange={setSupplierId}
                options={supplierOptions}
              />
            </FormField>
          ) : null}

          <FormField label="操作人" htmlFor="catalogue-operator" error={fieldError("operator")}>
            <EmployeeNameSelect
              id="catalogue-operator"
              label="操作人"
              value={operator}
              onChange={setOperator}
              employees={state.employees}
              placeholder="选择操作人"
              invalid={!!fieldError("operator")}
            />
          </FormField>

          <FormField label="参考单号（可选）" htmlFor="catalogue-reference" error={fieldError("reference")}>
            <Input
              id="catalogue-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="送货单或参考号"
              className="h-11"
              autoComplete="off"
            />
          </FormField>

          <FormField label="备注（可选）" htmlFor="catalogue-notes" error={fieldError("notes")}>
            <Textarea
              id="catalogue-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20"
            />
          </FormField>

          {type === "return" && jobBalance ? (
            <p className="text-xs leading-5 text-muted-foreground">
              此工单已出库 {formatQty(jobBalance.issued)}，已退 {formatQty(jobBalance.returned)}，还可退 {formatQty(jobBalance.returnable)}。
            </p>
          ) : null}

          {validation.ok ? (
            <p className="rounded-lg bg-[#f3f8fb] px-3 py-2 text-sm text-[#1c3144]" role="status">
              {title} {formatQty(validation.value.quantity)} {unit.label}
              <span className="mt-1 block tabular-nums">
                库存 {formatQty(validation.value.before)} → {formatQty(validation.value.after)}
              </span>
            </p>
          ) : null}

          {banner ? (
            <p className="text-sm text-destructive" role="alert">
              {banner}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-11 bg-white" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" className="h-11 px-4" disabled={submitting} data-testid="catalogue-submit-movement">
              {submitting ? "正在记账…" : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
