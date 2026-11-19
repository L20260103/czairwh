import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { categorySelectOptions, descendantIds } from "@/lib/inventory/catalog";
import type { Category, CategoryErrors } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

/** 新增或编辑类别。中英文至少填一个，界面显示成「中文 English」。 */
export function CategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { state, saveCategory, removeCategory } = useInventory();
  const [nameZh, setNameZh] = useState(category?.nameZh ?? "");
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "root");
  const [sortOrder, setSortOrder] = useState(category ? String(category.sortOrder) : "0");
  const [errors, setErrors] = useState<CategoryErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const excluded = category ? descendantIds(state.categories, category.id) : new Set<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveCategory({ nameZh, nameEn, parentId, sortOrder }, category?.id);
      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.errors.form ?? "请先改掉标红的字段");
        return;
      }
      toast.success(category ? "类别已更新" : "类别已添加");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!category) return;
    const result = await removeCategory(category.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("类别已删除");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" style={{ maxWidth: "32rem" }}>
        <DialogHeader>
          <DialogTitle>{category ? "编辑类别" : "新增类别"}</DialogTitle>
          <DialogDescription>中文名和英文名至少填一个。两边都有时显示为「中文 English」。可以挂在上级下面。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormField label="中文名" htmlFor="category-zh" error={errors.nameZh}>
            <Input id="category-zh" value={nameZh} onChange={(event) => setNameZh(event.target.value)} className="h-11" placeholder="例如 风管和出风" />
          </FormField>
          <FormField label="英文名" htmlFor="category-en" error={errors.nameEn}>
            <Input
              id="category-en"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              className="h-11"
              placeholder="例如 Ducting & Air Distribution"
            />
          </FormField>
          <FormField label="上级" htmlFor="category-parent" error={errors.parentId} hint="顶级没有上级。">
            <OptionSelect
              id="category-parent"
              label="上级类别"
              value={parentId}
              onChange={setParentId}
              options={[{ value: "root", label: "无（顶级）" }, ...categorySelectOptions(state.categories, excluded)]}
            />
          </FormField>
          <FormField label="排序" htmlFor="category-sort" error={errors.sortOrder} hint="数字小的排在前面。同级按这个数，再按名称。">
            <Input id="category-sort" inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="h-11 tabular-nums" />
          </FormField>
          {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
          <DialogFooter>
            {category && !confirmDelete ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                删除
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存类别"}
            </Button>
          </DialogFooter>
          {confirmDelete ? (
            <div className="rounded-lg bg-[#fff1ef] p-3 text-sm text-[#8d2f2f]">
              <p>有下级或已有物料使用时不能删除。</p>
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
