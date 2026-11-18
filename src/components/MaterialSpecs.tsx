import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createId } from "@/lib/inventory/inventory";
import { specsFromEditRows, visibleSpecEntries, type SpecEditRow } from "@/lib/inventory/specs";

/** 技术参数：上面是双语定义列表，展开后按键值编辑。 */
export function MaterialSpecs({ rows, onChange }: { rows: SpecEditRow[]; onChange: (rows: SpecEditRow[]) => void }) {
  const visible = visibleSpecEntries(specsFromEditRows(rows));

  function update(id: string, patch: Partial<Pick<SpecEditRow, "key" | "value">>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  function add() {
    onChange([...rows, { id: createId(), key: "", value: "", originalKey: "", original: undefined }]);
  }

  return (
    <section className={visible.length > 0 ? "rounded-lg bg-[#f4f8fa] p-3 ring-1 ring-[#d5e3ea]" : undefined}>
      {visible.length > 0 ? (
        <>
          <h3 id="material-specs" className="text-sm font-semibold text-[#1c3144]">
            技术参数 / Specs
          </h3>
          <dl className="mt-3 grid grid-cols-[minmax(6.75rem,10rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
            {visible.map((entry) => (
              <Fragment key={entry.key}>
                <dt>
                  <span className="block text-[13px] font-medium leading-5 text-[#1c3144]">{entry.label.primary}</span>
                  {entry.label.secondary ? (
                    <span className="block text-[11px] leading-4 text-muted-foreground">{entry.label.secondary}</span>
                  ) : null}
                </dt>
                <dd className="min-w-0 self-center break-words text-sm leading-5 text-[#1c3144]">{entry.text}</dd>
              </Fragment>
            ))}
          </dl>
        </>
      ) : null}
      <details className={visible.length > 0 ? "mt-3 border-t border-[#d5e3ea] pt-3" : undefined}>
        <summary className="cursor-pointer text-sm font-medium text-[#1f5f78]">
          {visible.length > 0 ? "编辑参数 / Edit specs" : "添加技术参数 / Add specs"}
        </summary>
        <div className="mt-3 grid gap-2" aria-label="技术参数键值">
          {rows.map((row, index) => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_auto]">
              <Input
                value={row.key}
                onChange={(event) => update(row.id, { key: event.target.value })}
                className="h-10 bg-white"
                placeholder="参数名，例如 refrigerant"
                aria-label={`参数名 ${index + 1}`}
                autoComplete="off"
              />
              <Input
                value={row.value}
                onChange={(event) => update(row.id, { value: event.target.value })}
                className="h-10 bg-white"
                placeholder="参数值"
                aria-label={`参数值 ${index + 1}`}
                autoComplete="off"
              />
              <Button type="button" variant="outline" className="h-10 bg-white" onClick={() => remove(row.id)}>
                移除
              </Button>
            </div>
          ))}
          <div>
            <Button type="button" variant="outline" className="h-10 bg-white" onClick={add}>
              添加一行
            </Button>
          </div>
        </div>
      </details>
    </section>
  );
}
