import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier, SupplierErrors } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

/** 新增或编辑供应商主档。报价在物料里维护。 */
export function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { saveSupplier, removeSupplier } = useInventory();
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [errors, setErrors] = useState<SupplierErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveSupplier({ name, contact, notes }, supplier?.id);
      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.errors.form ?? "请先改掉标红的字段");
        return;
      }
      toast.success(supplier ? "供应商已更新" : "供应商已添加");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!supplier) return;
    const result = await removeSupplier(supplier.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("供应商已删除");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" style={{ maxWidth: "32rem" }}>
        <DialogHeader>
          <DialogTitle>{supplier ? "编辑供应商" : "新增供应商"}</DialogTitle>
          <DialogDescription>这里只记供应商本身。他们卖的货号、品名和未含 GST 价格写在对应物料上。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormField label="名称" htmlFor="supplier-name" error={errors.name}>
            <Input id="supplier-name" value={name} onChange={(event) => setName(event.target.value)} className="h-11" />
          </FormField>
          <FormField label="联系方式" htmlFor="supplier-contact" error={errors.contact} hint="电话、邮箱或其他联系文字，可以不填。">
            <Input id="supplier-contact" value={contact} onChange={(event) => setContact(event.target.value)} className="h-11" />
          </FormField>
          <FormField label="备注" htmlFor="supplier-notes" error={errors.notes}>
            <Textarea id="supplier-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
          <DialogFooter>
            {supplier && !confirmDelete ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                删除
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存供应商"}
            </Button>
          </DialogFooter>
          {confirmDelete ? (
            <div className="rounded-lg bg-[#fff1ef] p-3 text-sm text-[#8d2f2f]">
              <p>还有报价或入库记录时不能删除。</p>
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
