import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { compareEmployees } from "@/lib/inventory/catalog";
import { normalizeText } from "@/lib/inventory/inventory";
import type { Employee } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

type PopupBox = { top: number; left: number; width: number; maxHeight: number };

function measurePopup(anchor: HTMLElement): PopupBox {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const chrome = 36;
  const desired = 288;
  const below = window.innerHeight - rect.bottom - gap - 8 - chrome;
  const above = rect.top - gap - 8 - chrome;
  const openUp = below < 160 && above > below;
  const maxHeight = Math.max(120, Math.min(desired, openUp ? above : below));
  const width = Math.max(rect.width, 240);
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
  const top = openUp ? Math.max(8, rect.top - gap - maxHeight - chrome) : rect.bottom + gap;
  return { top, left, width, maxHeight };
}

/**
 * 在职员工的可搜索下拉。
 * 当前值不在名单里（例如「待补」）时仍显示为当前值；不重新选择就不会改掉。
 */
export function EmployeeNameSelect({
  id,
  label,
  value,
  onChange,
  employees,
  disabled,
  allowEmpty = false,
  placeholder = "选择员工",
  invalid,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  employees: Employee[];
  disabled?: boolean;
  /** 退库领用人可以清空。 */
  allowEmpty?: boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [box, setBox] = useState<PopupBox | null>(null);

  const active = useMemo(
    () => employees.filter((employee) => employee.active).slice().sort(compareEmployees),
    [employees],
  );
  const known = active.some((employee) => normalizeText(employee.name) === normalizeText(value));
  const legacy = value.trim() && !known ? value : "";
  const query = search.trim().toLowerCase();
  const matches = (name: string) => !query || name.toLowerCase().includes(query);
  const visible = active.filter((employee) => matches(employee.name));
  const showLegacy = !!legacy && matches(legacy);
  const showEmpty = allowEmpty && (!query || "不填".includes(query));
  const options: { key: string; name: string; kind: "empty" | "legacy" | "employee" }[] = [
    ...(showEmpty ? [{ key: "empty", name: "", kind: "empty" as const }] : []),
    ...(showLegacy ? [{ key: `legacy:${legacy}`, name: legacy, kind: "legacy" as const }] : []),
    ...visible.map((employee) => ({ key: employee.id, name: employee.name, kind: "employee" as const })),
  ];
  const activeIndex = Math.min(highlight, Math.max(options.length - 1, 0));

  function close() {
    setOpen(false);
    setSearch("");
    setHighlight(0);
  }

  function choose(next: string) {
    onChange(next);
    close();
  }

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      if (anchorRef.current) setBox(measurePopup(anchorRef.current));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = popupRef.current?.querySelector('[data-highlighted="true"]');
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, search]);

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(options.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option.name);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  const popup =
    open && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popupRef}
            data-employee-popup="true"
            className="fixed z-[80] overflow-hidden rounded-lg bg-white text-[#1c3144] shadow-lg ring-1 ring-foreground/10"
            style={{ top: box.top, left: box.left, width: box.width }}
          >
            <ul id={listId} role="listbox" aria-label={label} className="overflow-auto p-1" style={{ maxHeight: box.maxHeight }}>
              {options.length === 0 ? (
                <li className="px-2 py-3 text-sm text-muted-foreground">没有匹配的员工。</li>
              ) : (
                options.map((option, index) => {
                  const selected = option.kind === "empty" ? value.trim() === "" : normalizeText(option.name) === normalizeText(value);
                  const highlighted = index === activeIndex;
                  return (
                    <li key={option.key} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-highlighted={highlighted ? "true" : "false"}
                        data-employee-name={option.kind === "employee" ? option.name : undefined}
                        data-legacy-option={option.kind === "legacy" ? "true" : undefined}
                        className={cn(
                          "flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left text-sm",
                          highlighted || selected ? "bg-[#e7f2f6]" : "hover:bg-[#f4f7f9]",
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          choose(option.name);
                        }}
                        onMouseEnter={() => setHighlight(index)}
                      >
                        <span>{option.kind === "empty" ? "不填" : option.name}</span>
                        {option.kind === "legacy" ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground">当前值，不在名单</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <p className="border-t border-[#e4ebf0] px-2 py-1.5 text-xs text-muted-foreground">
              共 {active.length} 名在职员工 / active staff
            </p>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef} className="grid gap-1" data-testid={id ? `employee-select-${id}` : "employee-select"}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        data-current-value={value}
        data-editable={disabled ? "false" : "true"}
        onClick={() => {
          if (disabled) return;
          if (open) close();
          else setOpen(true);
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          invalid ? "border-destructive ring-3 ring-destructive/20" : "border-input",
          !value.trim() && "text-muted-foreground",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{value.trim() ? value : placeholder}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <Input
          ref={searchRef}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setHighlight(0);
          }}
          onKeyDown={onSearchKeyDown}
          placeholder="搜索姓名 / Search name"
          aria-label={`搜索${label}`}
          aria-controls={listId}
          aria-expanded={open}
          autoComplete="off"
          className="h-11 bg-white"
        />
      ) : null}
      {popup}
    </div>
  );
}
