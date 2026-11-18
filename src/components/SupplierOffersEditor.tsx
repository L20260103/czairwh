import { useState } from "react";

import { FormField } from "@/components/common";
import { OptionSelect } from "@/components/OptionSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bilingualLabel, formatAud } from "@/lib/format";
import { parsePrice } from "@/lib/inventory/catalog";
import { createId } from "@/lib/inventory/inventory";
import type { Supplier, SupplierOfferDraft } from "@/lib/inventory/types";

function blankOffer(): SupplierOfferDraft {
  return { key: createId(), supplierId: "", supplierCode: "", supplierProductName: "", price: "", notes: "" };
}

/** 某物料的供应商报价。货号可以重复，靠对方品名区分。价格最低的行会标出来。 */
export function SupplierOffersEditor({
  offers,
  suppliers,
  onChange,
}: {
  offers: SupplierOfferDraft[];
  suppliers: Supplier[];
  onChange: (offers: SupplierOfferDraft[]) => void;
}) {
  const [draft, setDraft] = useState<SupplierOfferDraft>(() => blankOffer());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priced = offers.flatMap((offer) => {
    const parsed = parsePrice(offer.price);
    return parsed.ok ? [{ key: offer.key, price: parsed.value }] : [];
  });
  const lowest = priced.length > 0 ? Math.min(...priced.map((offer) => offer.price)) : null;

  function commitDraft() {
    if (!draft.supplierId) {
      setError("报价要选择供应商。");
      return;
    }
    if (!draft.supplierProductName.trim()) {
      setError("请填写对方品名。");
      return;
    }
    const price = parsePrice(draft.price);
    if (!price.ok) {
      setError(price.error);
      return;
    }
    const next = editingKey ? offers.map((offer) => (offer.key === editingKey ? { ...draft, key: editingKey, id: offer.id } : offer)) : [...offers, draft];
    onChange(next);
    setDraft(blankOffer());
    setEditingKey(null);
    setError(null);
  }

  return (
    <div className="grid gap-3 rounded-lg border border-[#d5dee6] p-3">
      <div>
        <p className="text-sm font-semibold text-[#1c3144]">供应商报价</p>
        <p className="text-xs leading-5 text-muted-foreground">
          同一件内部物料，各供应商可以有不同货号、品名和未含 GST 的价格。货号即使在同一家也可以重复。币种是澳元。
        </p>
      </div>
      {offers.length === 0 ? <p className="text-sm text-muted-foreground">还没有报价。</p> : null}
      <ul className="grid gap-2">
        {offers.map((offer) => {
          const supplier = suppliers.find((item) => item.id === offer.supplierId);
          const parsed = parsePrice(offer.price);
          const cheapest = parsed.ok && parsed.value === lowest;
          return (
            <li
              key={offer.key}
              className={cheapest ? "rounded-lg bg-[#f3faf6] px-3 py-2 ring-1 ring-[#c9e0d4]" : "rounded-lg bg-[#f7fafc] px-3 py-2"}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {supplier?.name ?? "未选供应商"}
                    {offer.supplierCode ? ` · ${offer.supplierCode}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{offer.supplierProductName || "未填对方品名"}</p>
                </div>
                <div className="text-right">
                  {cheapest ? (
                    <Badge variant="outline" className="mb-1 border-[#c9e0d4] bg-white text-[#1f7a4d]">
                      最低
                    </Badge>
                  ) : null}
                  <p className="text-sm font-semibold tabular-nums">{parsed.ok ? formatAud(parsed.value) : offer.price || "—"}</p>
                  <p className="text-[11px] text-muted-foreground">未含 GST</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 bg-white"
                  onClick={() => {
                    setDraft(offer);
                    setEditingKey(offer.key);
                    setError(null);
                  }}
                >
                  编辑
                </Button>
                <Button type="button" variant="outline" className="h-8 bg-white" onClick={() => onChange(offers.filter((item) => item.key !== offer.key))}>
                  移除
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {suppliers.length === 0 ? (
        <p className="text-xs leading-5 text-[#8a4b16]">先到供应商页新增供应商，才能添加报价。</p>
      ) : (
        <div className="grid gap-3">
          <FormField label="供应商" htmlFor="offer-supplier">
            <OptionSelect
              id="offer-supplier"
              label="报价供应商"
              value={draft.supplierId || "none"}
              onChange={(value) => setDraft({ ...draft, supplierId: value === "none" ? "" : value })}
              options={[{ value: "none", label: "选择供应商" }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]}
            />
          </FormField>
          <FormField label="对方货号" htmlFor="offer-code" hint="可以重复。例如同一货号对应两件不同的货。">
            <Input
              id="offer-code"
              value={draft.supplierCode}
              onChange={(event) => setDraft({ ...draft, supplierCode: event.target.value })}
              placeholder="例如 CRBB450/500"
              className="h-11"
            />
          </FormField>
          <FormField label="对方品名" htmlFor="offer-name" hint="用供应商目录里的名字，不必和我们的中英文名相同。">
            <Input
              id="offer-name"
              value={draft.supplierProductName}
              onChange={(event) => setDraft({ ...draft, supplierProductName: event.target.value })}
              className="h-11"
            />
          </FormField>
          <FormField label="价格（未含 GST，澳元）" htmlFor="offer-price">
            <Input
              id="offer-price"
              inputMode="decimal"
              value={draft.price}
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              placeholder="例如 12.50"
              className="h-11 tabular-nums"
            />
          </FormField>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="bg-white" onClick={commitDraft}>
              {editingKey ? "更新这条报价" : "加入报价"}
            </Button>
            {editingKey ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(blankOffer());
                  setEditingKey(null);
                  setError(null);
                }}
              >
                取消编辑
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            报价随物料一起保存。有中英文名时，物料显示为「{bilingualLabel("中文", "English")}」这种格式。
          </p>
        </div>
      )}
    </div>
  );
}
