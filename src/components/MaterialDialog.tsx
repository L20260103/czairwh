import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common";
import { OptionSelect } from "@/components/OptionSelect";
import { SupplierOffersEditor } from "@/components/SupplierOffersEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { categorySelectOptions, validateOffers } from "@/lib/inventory/catalog";
import { hasMovements } from "@/lib/inventory/inventory";
import type { Material, MaterialErrors, SupplierOfferDraft } from "@/lib/inventory/types";
import { isUnitCode, LOCATION_SUGGESTIONS, UNITS, type UnitCode } from "@/lib/inventory/units";
import { Link } from "@/lib/router";
import { useInventory } from "@/store/InventoryProvider";

/** 新增 / 编辑物料，以及这家物料的供应商报价。 */
export function MaterialDialog({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const { state, saveMaterial, removeMaterial } = useInventory();
  const [persistedId, setPersistedId] = useState(material?.id);
  const locked = persistedId ? hasMovements(state, persistedId) : false;
  const [sku, setSku] = useState(material?.sku ?? "");
  const [nameZh, setNameZh] = useState(material?.nameZh ?? "");
  const [nameEn, setNameEn] = useState(material?.nameEn ?? "");
  const [categoryId, setCategoryId] = useState(material?.categoryId ?? "none");
  const [unit, setUnit] = useState<UnitCode>(material?.unit ?? "piece");
  const [location, setLocation] = useState(material?.location ?? "");
  const [minStock, setMinStock] = useState(material ? String(material.minStock) : "0");
  const [note, setNote] = useState(material?.note ?? "");
  const [active, setActive] = useState(material?.active ?? true);
  const [offers, setOffers] = useState<SupplierOfferDraft[]>(() =>
    state.supplierProducts
      .filter((offer) => offer.materialId === material?.id)
      .map((offer) => ({
        id: offer.id,
        key: offer.id,
        supplierId: offer.supplierId,
        supplierCode: offer.supplierCode,
        supplierProductName: offer.supplierProductName,
        price: String(offer.priceExGst),
        notes: offer.notes,
      })),
  );
  const [errors, setErrors] = useState<MaterialErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const others = state.supplierProducts.filter((offer) => offer.materialId !== persistedId && !offers.some((item) => item.id === offer.id));
    const checked = validateOffers(offers, state.suppliers, others);
    if (!checked.ok) {
      setErrors({ offers: checked.error });
      toast.error(checked.error);
      return;
    }
    setSaving(true);
    try {
      const result = await saveMaterial(
        { sku, nameZh, nameEn, categoryId, unit, location, minStock, note, active },
        checked.value,
        persistedId,
      );
      if (!result.ok) {
        if (result.materialId) setPersistedId(result.materialId);
        setErrors(result.errors);
        toast.error(result.errors.form ?? result.errors.offers ?? "请先改掉标红的字段");
        return;
      }
      toast.success(persistedId ? "物料已更新" : "物料已加入目录");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!persistedId) return;
    const result = await removeMaterial(persistedId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("物料已从目录删除");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" style={{ maxWidth: "36rem" }}>
        <DialogHeader>
          <DialogTitle>{persistedId ? "编辑物料" : "新增物料"}</DialogTitle>
          <DialogDescription>中文名和英文名至少填一个，两边都有时显示为「中文 English」。保存后所有打开这个网址的人都会看到。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormField label="SKU" htmlFor="sku" error={errors.sku} hint={locked ? "已有流水，SKU 不能改。" : "字母、数字和连字符。"}>
            <Input id="sku" value={sku} onChange={(event) => setSku(event.target.value)} readOnly={locked} className="h-11" aria-invalid={!!errors.sku} />
          </FormField>
          <FormField label="中文名" htmlFor="material-name-zh" error={errors.nameZh} hint="可以只填英文名。">
            <Input id="material-name-zh" value={nameZh} onChange={(event) => setNameZh(event.target.value)} className="h-11" aria-invalid={!!errors.nameZh} />
          </FormField>
          <FormField label="英文名" htmlFor="material-name-en" error={errors.nameEn}>
            <Input id="material-name-en" value={nameEn} onChange={(event) => setNameEn(event.target.value)} className="h-11" aria-invalid={!!errors.nameEn} />
          </FormField>
          <FormField label="类别" htmlFor="category" error={errors.categoryId} hint="从类别表里选。没有写死的类别清单。">
            {state.categories.length === 0 ? (
              <p className="text-sm text-[#8a4b16]">
                还没有类别。请先到<Link href="/categories" className="text-[#1f5f78]">类别</Link>新增。
              </p>
            ) : (
              <OptionSelect
                id="category"
                label="类别"
                value={categoryId}
                onChange={setCategoryId}
                options={[{ value: "none", label: "请选择类别" }, ...categorySelectOptions(state.categories)]}
              />
            )}
          </FormField>
          <FormField label="单位" htmlFor="unit" error={errors.unit} hint={locked ? "已有流水，单位不能改。" : "个数类只能整数记账，米和千克可以有小数。"}>
            <OptionSelect
              id="unit"
              label="单位"
              value={unit}
              disabled={locked}
              onChange={(value) => {
                if (isUnitCode(value)) setUnit(value);
              }}
              options={UNITS.map((item) => ({
                value: item.code,
                label: `${item.label} · ${item.en} · ${item.integer ? "整数" : "可含小数"}`,
              }))}
            />
          </FormField>
          <FormField label="库位" htmlFor="location" error={errors.location}>
            <Input id="location" value={location} onChange={(event) => setLocation(event.target.value)} list="location-options" className="h-11" aria-invalid={!!errors.location} />
            <datalist id="location-options">
              {LOCATION_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </FormField>
          <FormField label="最低库存" htmlFor="min-stock" error={errors.minStock} hint="填 0 表示不监控。不会改变现存数量。">
            <Input id="min-stock" inputMode="decimal" value={minStock} onChange={(event) => setMinStock(event.target.value)} className="h-11 tabular-nums" aria-invalid={!!errors.minStock} />
          </FormField>
          <FormField label="备注" htmlFor="material-note" error={errors.note}>
            <Textarea id="material-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          <SupplierOffersEditor offers={offers} suppliers={state.suppliers} onChange={setOffers} />
          {errors.offers ? <p className="text-sm text-destructive">{errors.offers}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={active ? "default" : "outline"} onClick={() => setActive(true)}>
              启用
            </Button>
            <Button type="button" variant={active ? "outline" : "default"} onClick={() => setActive(false)}>
              停用
            </Button>
          </div>
          {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
          <DialogFooter>
            {persistedId && !locked && !confirmDelete ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                删除
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving || state.categories.length === 0}>
              {saving ? "正在保存…" : "保存物料"}
            </Button>
          </DialogFooter>
          {locked ? <p className="text-xs text-muted-foreground">已有流水，不能删除。可以停用，历史仍保留。有报价时也要先移除报价才能删除。</p> : null}
          {confirmDelete ? (
            <div className="rounded-lg bg-[#fff1ef] p-3 text-sm text-[#8d2f2f]">
              <p>删除后这条目录就没了。它还没有任何流水。若还有供应商报价，需要先移除。</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                  取消删除
                </Button>
                <Button type="button" variant="destructive" onClick={() => void handleDelete()}>
                  确认删除
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
