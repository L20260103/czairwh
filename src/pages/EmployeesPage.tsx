import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, FormField, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compareEmployees } from "@/lib/inventory/catalog";
import type { Employee, EmployeeErrors } from "@/lib/inventory/types";
import { useInventory } from "@/store/InventoryProvider";

/** 员工（#/employees）。操作人和领用人从在职名单里选。 */
export function EmployeesPage() {
  const { state, saveEmployee, setEmployeeActive } = useInventory();
  const rows = useMemo(() => state.employees.slice().sort(compareEmployees), [state.employees]);
  const activeCount = rows.filter((employee) => employee.active).length;
  const [name, setName] = useState("");
  const [addErrors, setAddErrors] = useState<EmployeeErrors>({});
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editErrors, setEditErrors] = useState<EmployeeErrors>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      const result = await saveEmployee(name);
      if (!result.ok) {
        setAddErrors(result.errors);
        toast.error(result.errors.form ?? result.errors.name ?? "没能添加员工");
        return;
      }
      setName("");
      setAddErrors({});
      toast.success(`已添加 ${result.employee.name}`);
    } finally {
      setAdding(false);
    }
  }

  function startRename(employee: Employee) {
    setEditingId(employee.id);
    setDraft(employee.name);
    setEditErrors({});
  }

  async function handleRename(event: FormEvent<HTMLFormElement>, employee: Employee) {
    event.preventDefault();
    if (savingId) return;
    setSavingId(employee.id);
    try {
      const result = await saveEmployee(draft, employee.id);
      if (!result.ok) {
        setEditErrors(result.errors);
        toast.error(result.errors.form ?? result.errors.name ?? "没能改名");
        return;
      }
      setEditingId(null);
      setEditErrors({});
      toast.success("姓名已更新");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(employee: Employee) {
    if (savingId) return;
    setSavingId(employee.id);
    try {
      const result = await setEmployeeActive(employee.id, !employee.active);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.employee.active ? `${result.employee.name} 已启用` : `${result.employee.name} 已停用`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <PageHeader title="员工 Staff">
        操作人和领用人都从这里的在职员工里选，按排序出现在出入库和流水编辑的下拉里。停用后不再出现在下拉里，已经写在流水上的名字不会被改掉。不在名单上的旧值（例如「待补」）会继续显示，直到你改选别人。
      </PageHeader>
      <section className="max-w-2xl rounded-xl bg-white p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="text-sm font-semibold text-[#1c3144]">新增员工 / Add staff</h2>
        <form onSubmit={handleAdd} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" noValidate>
          <FormField label="姓名 / Name" htmlFor="employee-name" error={addErrors.name ?? addErrors.form} hint="1 到 40 个字，不能和现有员工重名。">
            <Input
              id="employee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如 Sam Sun"
              className="h-11"
              autoComplete="off"
              aria-invalid={!!(addErrors.name || addErrors.form)}
            />
          </FormField>
          <Button type="submit" className="h-11 sm:mt-7" disabled={adding}>
            {adding ? "正在添加…" : "添加 / Add"}
          </Button>
        </form>

        <div className="mt-6 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#1c3144]">名单 / Staff list</h2>
          <p className="text-xs tabular-nums text-muted-foreground">
            在职 {activeCount} · 停用 {rows.length - activeCount}
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="还没有员工">添加后，出入库和流水编辑就可以从名单里选操作人和领用人。</EmptyState>
          </div>
        ) : (
          <ul className="mt-3 grid gap-2" aria-label="员工名单">
            {rows.map((employee) => {
              const editing = editingId === employee.id;
              const busy = savingId === employee.id;
              return (
                <li key={employee.id} className="rounded-lg border border-[#e4ebf0] px-3 py-2.5" data-employee-row={employee.name}>
                  {editing ? (
                    <form onSubmit={(event) => void handleRename(event, employee)} className="grid gap-2" noValidate>
                      <FormField label="新姓名 / New name" htmlFor={`rename-${employee.id}`} error={editErrors.name ?? editErrors.form}>
                        <Input
                          id={`rename-${employee.id}`}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          className="h-11"
                          autoComplete="off"
                          aria-invalid={!!(editErrors.name || editErrors.form)}
                        />
                      </FormField>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" className="h-10" disabled={busy}>
                          {busy ? "正在保存…" : "保存 / Save"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 bg-white"
                          onClick={() => {
                            setEditingId(null);
                            setEditErrors({});
                          }}
                          disabled={busy}
                        >
                          取消 / Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-[#1c3144]">{employee.name}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">排序 {employee.sortOrder}</span>
                          {employee.active ? (
                            <Badge variant="outline" className="border-[#c9e0d4] bg-[#f3faf6] text-[#1f7a4d]">
                              在职 / Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">已停用 / Inactive</Badge>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => startRename(employee)} disabled={busy}>
                          改名 / Rename
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 bg-white"
                          onClick={() => void toggleActive(employee)}
                          disabled={busy}
                        >
                          {employee.active ? "停用 / Deactivate" : "启用 / Activate"}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
