import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hasMovements } from "@/lib/inventory/inventory";
import type { Material, MaterialErrors } from "@/lib/inventory/types";
import { CATEGORY_SUGGESTIONS, isUnitCode, LOCATION_SUGGESTIONS, UNITS, type UnitCode } from "@/lib/inventory/units";
import { useInventory } from "@/store/InventoryProvider";

/** 新增 / 编辑物料。material 为 null 时是新增。 */
export function MaterialDialog({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const { state, saveMaterial, removeMaterial } = useInventory();
  const locked = material ? hasMovements(state, material.id) : false;
  const [sku, setSku] = useState(material?.sku ?? "");
  const [name, setName] = useState(material?.name ?? "");
  const [category, setCategory] = useState(material?.category ?? CATEGORY_SUGGESTIONS[0]);
  const [unit, setUnit] = useState<UnitCode>(material?.unit ?? "piece");
  const [location, setLocation] = useState(material?.location ?? "");
  const [minStock, setMinStock] = useState(material ? String(material.minStock) : "0");
  const [note, setNote] = useState(material?.note ?? "");
  const [active, setActive] = useState(material?.active ?? true);
  const [errors, setErrors] = useState<MaterialErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = saveMaterial({ sku, name, category, unit, location, minStock, note, active }, material?.id);
      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.errors.form ?? "请先改掉标红的字段");
        return;
      }
      toast.success(material ? "物料已更新" : "物料已加入目录");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!material) return;
    const result = removeMaterial(material.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("物料已从目录删除");
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" style={{ maxWidth: "36rem" }}>
        <DialogHeader>
          <DialogTitle>{material ? "编辑物料" : "新增物料"}</DialogTitle>
          <DialogDescription>
            {material?.sample
              ? "这是示例数据。可以改名称和最低库存，示例标记会保留。"
              : "本机新增的物料仍然只存在这台浏览器里。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormField
            label="SKU"
            htmlFor="sku"
            error={errors.sku}
            hint={locked ? "已有流水，SKU 不能改。" : "字母、数字和连字符。"}
          >
            <Input
              id="sku"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              readOnly={locked}
              className="h-11"
              aria-invalid={!!errors.sku}
            />
          </FormField>
          <FormField label="名称" htmlFor="material-name" error={errors.name}>
            <Input
              id="material-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11"
              aria-invalid={!!errors.name}
            />
          </FormField>
          <FormField label="类别" htmlFor="category" error={errors.category}>
            <Input
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              list="category-options"
              className="h-11"
              aria-invalid={!!errors.category}
            />
            <datalist id="category-options">
              {CATEGORY_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </FormField>
          <FormField
            label="单位"
            htmlFor="unit"
            error={errors.unit}
            hint={locked ? "已有流水，单位不能改。" : "个数类只能整数记账，米和千克可以有小数。"}
          >
            <OptionSelect
              id="unit"
              label="单位"
              value={unit}
              disabled={locked}
              onChange={(value) => {
                if (isUnitCode(value)) setUnit(value);
              }}
              options={UNITS.map((u) => ({
                value: u.code,
                label: `${u.label} · ${u.en} · ${u.integer ? "整数" : "可含小数"}`,
              }))}
            />
          </FormField>
          <FormField label="库位" htmlFor="location" error={errors.location}>
            <Input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              list="location-options"
              className="h-11"
              aria-invalid={!!errors.location}
            />
            <datalist id="location-options">
              {LOCATION_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </FormField>
          <FormField label="最低库存" htmlFor="min-stock" error={errors.minStock} hint="填 0 表示不监控。不会改变现存数量。">
            <Input
              id="min-stock"
              inputMode="decimal"
              value={minStock}
              onChange={(event) => setMinStock(event.target.value)}
              className="h-11 tabular-nums"
              aria-invalid={!!errors.minStock}
            />
          </FormField>
          <FormField label="备注" htmlFor="material-note" error={errors.note}>
            <Textarea id="material-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
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
            {material && !locked && !confirmDelete ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                删除
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存物料"}
            </Button>
          </DialogFooter>
          {locked ? <p className="text-xs text-muted-foreground">已有流水，不能删除。可以停用，历史仍保留。</p> : null}
          {confirmDelete ? (
            <div className="rounded-lg bg-[#fff1ef] p-3 text-sm text-[#8d2f2f]">
              <p>删除后这条目录就没了。它还没有任何流水。</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                  取消删除
                </Button>
                <Button type="button" variant="destructive" onClick={handleDelete}>
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
