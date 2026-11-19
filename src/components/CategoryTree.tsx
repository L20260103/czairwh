import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { bilingualLabel } from "@/lib/format";
import { categoriesInTreeOrder } from "@/lib/inventory/catalog";
import type { Category } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

interface TreeNode {
  category: Category;
  children: TreeNode[];
}

function buildTree(categories: Category[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const { category } of categoriesInTreeOrder(categories)) {
    const node: TreeNode = { category, children: [] };
    nodes.set(category.id, node);
    const parent = category.parentId ? nodes.get(category.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function ancestorIds(categories: Category[], id: string): string[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ids: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(id)?.parentId ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    ids.push(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return ids;
}

/** 可折叠类别树。点名称筛选该类别及其下级，数字是这个范围里的物料数。 */
export function CategoryTree({
  categories,
  counts,
  total,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  counts: Map<string, number>;
  total: number;
  selectedId: string;
  onSelect: (categoryId: string) => void;
}) {
  const roots = useMemo(() => buildTree(categories), [categories]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const ancestorKey = selectedId ? ancestorIds(categories, selectedId).join(",") : "";

  useEffect(() => {
    if (!ancestorKey) return;
    setExpanded((current) => {
      const next = new Set(current);
      let changed = false;
      for (const id of ancestorKey.split(",")) {
        if (!id || next.has(id)) continue;
        next.add(id);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [ancestorKey]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid gap-0.5" data-testid="category-tree">
      <TreeButton
        label="全部类别"
        count={total}
        selected={selectedId === ""}
        depth={0}
        onClick={() => onSelect("")}
      />
      {roots.map((node) => (
        <TreeBranch
          key={node.category.id}
          node={node}
          depth={0}
          counts={counts}
          selectedId={selectedId}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeBranch({
  node,
  depth,
  counts,
  selectedId,
  expanded,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  counts: Map<string, number>;
  selectedId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const open = expanded.has(node.category.id);
  const label = bilingualLabel(node.category.nameZh, node.category.nameEn);
  return (
    <div>
      <div className="flex items-stretch" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            className="grid size-7 shrink-0 place-items-center rounded-md text-[#5d6e7c] hover:bg-[#e7eef3]"
            aria-expanded={open}
            aria-label={open ? `收起${label}` : `展开${label}`}
            onClick={() => onToggle(node.category.id)}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span className="size-7 shrink-0" />
        )}
        <TreeButton
          label={label}
          count={counts.get(node.category.id) ?? 0}
          selected={selectedId === node.category.id}
          depth={0}
          onClick={() => onSelect(node.category.id)}
          categoryId={node.category.id}
        />
      </div>
      {hasChildren && open
        ? node.children.map((child) => (
            <TreeBranch
              key={child.category.id}
              node={child}
              depth={depth + 1}
              counts={counts}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}

function TreeButton({
  label,
  count,
  selected,
  depth,
  onClick,
  categoryId,
}: {
  label: string;
  count: number;
  selected: boolean;
  depth: number;
  onClick: () => void;
  categoryId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={label}
      data-category-id={categoryId}
      data-category-label={label}
      onClick={onClick}
      style={depth > 0 ? { paddingLeft: depth * 12 } : undefined}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px]",
        selected ? "bg-[#e7f2f6] font-medium text-[#1f5f78]" : "text-[#1c3144] hover:bg-[#f4f7f9]",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}
