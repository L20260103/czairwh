import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bilingualLabel, formatAud, joinMeta, locationText, movementTypeLabel } from "@/lib/format";
import { formatQty, getJobBalance, getOnHand, validateMovement } from "@/lib/inventory/inventory";
import { specSearchText } from "@/lib/inventory/specs";
import type { MovementDraft, MovementErrors, MovementType } from "@/lib/inventory/types";
import { getUnit } from "@/lib/inventory/units";
import { cn } from "@/lib/utils";
import { useInventory } from "@/store/InventoryProvider";

const MOVEMENT_TYPES: { id: MovementType; label: string; hint: string }[] = [
  { id: "receipt", label: "入库", hint: "到货、期初或盘盈" },
  { id: "issue", label: "出库", hint: "领到工单上" },
  { id: "return", label: "退库", hint: "工单余料退回" },
];

/** 入库 / 出库 / 退库表单 + 右侧预览。 */
export function MovementForm({
  initialType,
  initialMaterialId,
  unknownMaterial,
  onMaterialChange,
}: {
  initialType: MovementType;
  initialMaterialId: string;
  unknownMaterial: boolean;
  onMaterialChange: (materialId: string) => void;
}) {
  const { state, postMovement } = useInventory();
  const initialMaterialExists = state.materials.some((m) => m.id === initialMaterialId);
  const [type, setType] = useState<MovementType>(initialType);
  const [materialId, setMaterialId] = useState(initialMaterialExists ? initialMaterialId : "");
  const [materialQuery, setMaterialQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [operator, setOperator] = useState(state.lastOperator);
  const [jobNumber, setJobNumber] = useState("");
  const [recipient, setRecipient] = useState("");
  const [supplierId, setSupplierId] = useState("none");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** 防止同一帧里连按两次提交。 */
  const submittingRef = useRef(false);

  function selectMaterial(id: string) {
    setMaterialId(id);
    onMaterialChange(id);
  }

  const draft: MovementDraft = {
    type,
    materialId,
    quantity,
    operator,
    jobNumber,
    recipient,
    supplierId: supplierId === "none" ? "" : supplierId,
    reference,
    notes,
  };
  // 每次渲染都校验一遍，用来显示预览和错误。
  const validation = validateMovement(state, draft, new Date().toISOString());
  const errors: MovementErrors = validation.ok ? {} : validation.errors;
  const material = state.materials.find((m) => m.id === materialId);
  const onHand = material ? getOnHand(state, material.id) : 0;
  const jobBalance = material && jobNumber.trim() ? getJobBalance(state, material.id, jobNumber) : null;

  /** 提交过之后才显示错误；force = true 时（该字段已填写）立即显示。 */
  function fieldError(field: keyof MovementErrors, force = false): string | undefined {
    if (!submitted && !force) return undefined;
    return errors[field];
  }

  const candidates = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    return state.materials
      .filter((m) => m.active || m.id === materialId)
      .filter((m) =>
        q ? `${m.sku} ${m.nameZh} ${m.nameEn} ${locationText(m.location)} ${specSearchText(m.specs)}`.toLowerCase().includes(q) : true,
      )
      .slice(0, 12);
  }, [materialId, materialQuery, state.materials]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (submittingRef.current || submitting) return;
    if (!validation.ok) {
      setSubmitError(errors.form ?? null);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await postMovement(draft);
      if (!result.ok) {
        const message = result.errors.form ?? result.errors.quantity ?? result.errors.jobNumber ?? "没能记账";
        setSubmitError(message);
        toast.error(message);
        return;
      }
      setSubmitError(null);
      toast.success(
        `${movementTypeLabel(result.movement.type)}已记下：${formatQty(result.movement.quantity)}，库存 ${formatQty(result.movement.beforeQty)} → ${formatQty(result.movement.afterQty)}`,
      );
      setQuantity("");
      setNotes("");
      setSubmitted(false);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const submitLabel = type === "receipt" ? "确认入库" : type === "issue" ? "确认出库" : "确认退库";

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-xl bg-white p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="记账类型">
          {MOVEMENT_TYPES.map((option) => {
            const checked = type === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setType(option.id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-left",
                  checked ? "border-[#1f5f78] bg-[#f3f8fb]" : "border-[#d5dee6] bg-white",
                )}
              >
                <span className="block text-sm font-semibold text-[#1c3144]">{option.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.hint}</span>
              </button>
            );
          })}
        </div>
        {fieldError("type") ? <p className="mt-2 text-xs text-destructive">{fieldError("type")}</p> : null}
        {unknownMaterial ? (
          <p className="mt-3 text-xs text-[#8a4b16]" role="status">
            链接里的物料不在目录中，请重新选择。
          </p>
        ) : null}

        <div className="mt-4 grid gap-4">
          <FormField
            label="物料"
            htmlFor="material-search"
            error={fieldError("materialId")}
            hint="可搜 SKU、名称、库位或型号。停用物料不会出现在这里。"
          >
            <Input
              id="material-search"
              value={materialQuery}
              onChange={(event) => setMaterialQuery(event.target.value)}
              placeholder="搜索 22mm、CZ-CU、冷媒柜"
              className="h-11"
              autoComplete="off"
              aria-invalid={!!fieldError("materialId")}
            />
          </FormField>
          <ul
            className="grid max-h-40 gap-1 overflow-auto rounded-lg border border-[#d5dee6] p-1 sm:max-h-56"
            aria-label="物料候选"
          >
            {candidates.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">没有匹配的物料。</li>
            ) : (
              candidates.map((candidate) => {
                const selected = candidate.id === materialId;
                return (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => selectMaterial(candidate.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-md px-2 py-2 text-left",
                        selected ? "bg-[#e7f2f6]" : "hover:bg-[#f4f7f9]",
                      )}
                      aria-pressed={selected}
                    >
                      <span>
                        <span className="block text-sm font-medium">{bilingualLabel(candidate.nameZh, candidate.nameEn)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {joinMeta([candidate.sku, locationText(candidate.location)])}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatQty(getOnHand(state, candidate.id))} {getUnit(candidate.unit).label}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <FormField
            label="数量"
            htmlFor="quantity"
            error={fieldError("quantity", quantity.trim().length > 0)}
            hint={
              material
                ? `单位「${getUnit(material.unit).label}」${getUnit(material.unit).integer ? "只接受整数" : "最多两位小数"}。不能为 0 或负数。`
                : "先选择物料。"
            }
          >
            <Input
              id="quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={material && !getUnit(material.unit).integer ? "例如 2.5" : "例如 2"}
              className="h-11 tabular-nums"
              autoComplete="off"
              aria-invalid={!!fieldError("quantity", quantity.trim().length > 0)}
            />
          </FormField>

          {type !== "receipt" ? (
            <FormField
              label="工单号"
              htmlFor="job-number"
              error={fieldError("jobNumber", jobNumber.trim().length > 0)}
              hint="手填。真实单号规则还没定。"
            >
              <Input
                id="job-number"
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
            <FormField label="领用人" htmlFor="recipient" error={fieldError("recipient")}>
              <Input
                id="recipient"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                list="recipients"
                placeholder="谁拿走这批料"
                className="h-11"
                autoComplete="off"
                aria-invalid={!!fieldError("recipient")}
              />
            </FormField>
          ) : null}

          {type === "return" ? (
            <FormField label="退回人（可选）" htmlFor="recipient" error={fieldError("recipient")}>
              <Input
                id="recipient"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="可以不填"
                className="h-11"
                autoComplete="off"
              />
            </FormField>
          ) : null}

          {type === "receipt" ? (
            <FormField
              label="参考单号（可选）"
              htmlFor="reference"
              error={fieldError("reference")}
              hint="送货单或供应商文字。这里没有供应商档案。"
            >
              <Input
                id="reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="例如送货单 DN-1102"
                className="h-11"
                autoComplete="off"
              />
            </FormField>
          ) : null}

          {type === "receipt" ? (
            <FormField label="供应商（可选）" htmlFor="movement-supplier" error={fieldError("supplierId")} hint="入库可以记下是哪家供应商来的货。">
              <OptionSelect
                id="movement-supplier"
                label="供应商"
                value={supplierId}
                onChange={setSupplierId}
                options={[
                  { value: "none", label: state.suppliers.length === 0 ? "还没有供应商" : "不指定供应商" },
                  ...state.suppliers.map((supplier) => {
                    const offer = state.supplierProducts
                      .filter((item) => item.supplierId === supplier.id && item.materialId === materialId)
                      .sort((a, b) => a.priceExGst - b.priceExGst)[0];
                    const label = offer
                      ? `${supplier.name}${offer.supplierCode ? ` · ${offer.supplierCode}` : ""} · ${formatAud(offer.priceExGst)}`
                      : supplier.name;
                    return { value: supplier.id, label };
                  }),
                ]}
              />
            </FormField>
          ) : null}

          <FormField
            label="操作人"
            htmlFor="operator"
            error={fieldError("operator")}
            hint="没有登录。这个名字只写进流水，不能证明是谁操作的。"
          >
            <Input
              id="operator"
              value={operator}
              onChange={(event) => setOperator(event.target.value)}
              list="operators"
              className="h-11"
              autoComplete="name"
              aria-invalid={!!fieldError("operator")}
            />
            <datalist id="operators">
              {[...new Set(state.movements.map((movement) => movement.operator).filter(Boolean))].map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <datalist id="recipients">
              {[...new Set(state.movements.map((movement) => movement.recipient).filter(Boolean))].map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </FormField>

          <FormField label="备注（可选）" htmlFor="notes" error={fieldError("notes")}>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="例如 二楼机房，或写明为什么和上一笔看起来一样"
              className="min-h-20"
            />
          </FormField>
        </div>

        {fieldError("form") || submitError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {fieldError("form") || submitError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" className="h-11 px-5" disabled={submitting} data-testid="submit-movement">
            {submitting ? "正在记账…" : submitLabel}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            数量、物料和类型记账后不能改。操作人、工单、领用、参考和备注可以在流水里改。数量为 0、负数、超过库存，或退库超过该工单领用时，不会写入流水。
          </p>
        </div>
      </div>

      <aside className="h-fit rounded-xl bg-[#1c3144] p-4 text-[#e7eef5] xl:sticky xl:top-28">
        <p className="text-xs tracking-wide text-[#b7c6d4]">本笔预览</p>
        {material ? (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-base font-semibold">{bilingualLabel(material.nameZh, material.nameEn)}</p>
              <p className="text-xs text-[#b7c6d4]">
                {joinMeta([material.sku, locationText(material.location)])}
              </p>
            </div>
            <div data-testid="stock-preview">
              <p className="text-xs text-[#b7c6d4]">当前库存</p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatQty(onHand)}
                <span className="ml-1 text-sm font-normal text-[#b7c6d4]">{getUnit(material.unit).label}</span>
              </p>
              <p className="text-xs text-[#b7c6d4]">最低库存 {formatQty(material.minStock)}</p>
            </div>
            {type === "return" && jobBalance ? (
              <p className="text-xs leading-5 text-[#d7e4ee]">
                此工单已出库 {formatQty(jobBalance.issued)}，已退 {formatQty(jobBalance.returned)}，还可退 {formatQty(jobBalance.returnable)}。
              </p>
            ) : null}
            {validation.ok ? (
              <p className="rounded-lg bg-[#274864] px-3 py-2 text-sm" role="status">
                {movementTypeLabel(type)} {formatQty(validation.value.quantity)} {getUnit(material.unit).label}
                <span className="mt-1 block tabular-nums text-[#f4e4d4]">
                  {formatQty(validation.value.before)} → {formatQty(validation.value.after)}
                </span>
              </p>
            ) : (
              <p className="text-xs leading-5 text-[#d7c4a4]">
                {errors.quantity ||
                  errors.jobNumber ||
                  errors.materialId ||
                  errors.operator ||
                  errors.recipient ||
                  "把必填项补齐后，这里会显示变动前和变动后。"}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#b7c6d4]">选择物料后，这里显示库存和记账结果。</p>
        )}
      </aside>
    </form>
  );
}
