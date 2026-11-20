import type { CSSProperties } from "react";

import type { MaterialPlacement, StorageLocation } from "@/lib/inventory/locations";
import { placementsByCode } from "@/lib/inventory/locations";
import { cn } from "@/lib/utils";

/**
 * 平面图格子。进深 5、沿墙 8：顶墙和前墙货格是 8×5，右墙转 90° 是 5×8。
 * 顶行：S3（半格宽）+ A–F + 水管区（一个进深见方）。
 * J 的左缘对齐 A/B 分界，大约离左墙一个货格。S1、S2 贴在 J 的后侧两端。
 */
const PLAN_W = 57;
const PLAN_H = 29;

interface RackSpec {
  bay: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "pallet" | "shelf";
  /** 托盘货架的两列沿墙排列。h = 左右，v = 上下。 */
  along?: "h" | "v";
}

const RACKS: RackSpec[] = [
  { bay: "S3", x: 0, y: 0, w: 4, h: 5, kind: "shelf" },
  { bay: "A", x: 4, y: 0, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "B", x: 12, y: 0, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "C", x: 20, y: 0, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "D", x: 28, y: 0, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "E", x: 36, y: 0, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "F", x: 44, y: 0, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "G", x: 52, y: 5, w: 5, h: 8, kind: "pallet", along: "v" },
  { bay: "H", x: 52, y: 13, w: 5, h: 8, kind: "pallet", along: "v" },
  { bay: "I", x: 52, y: 21, w: 5, h: 8, kind: "pallet", along: "v" },
  { bay: "J", x: 12, y: 24, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "K", x: 20, y: 24, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "L", x: 28, y: 24, w: 8, h: 5, kind: "pallet", along: "h" },
  { bay: "S1", x: 12, y: 12, w: 3, h: 12, kind: "shelf" },
  { bay: "S2", x: 17, y: 12, w: 3, h: 12, kind: "shelf" },
];

interface BayStat {
  zone: string;
  count: number;
  cols: Set<number>;
  codes: string[];
  hit: boolean;
}

function statsByBay(
  locations: StorageLocation[],
  placements: MaterialPlacement[],
  highlighted: Set<string> | null,
): Map<string, BayStat> {
  const byCode = placementsByCode(placements);
  const stats = new Map<string, BayStat>();
  for (const location of locations) {
    let stat = stats.get(location.bay);
    if (!stat) {
      stat = { zone: location.zone, count: 0, cols: new Set(), codes: [], hit: false };
      stats.set(location.bay, stat);
    }
    stat.codes.push(location.code);
    const count = byCode.get(location.code)?.length ?? 0;
    stat.count += count;
    if (count > 0 && location.col != null) stat.cols.add(location.col);
    if (highlighted?.has(location.code)) stat.hit = true;
  }
  return stats;
}

function gridBox(x: number, y: number, w: number, h: number): CSSProperties {
  return { gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` };
}

function percentBox(x: number, y: number, w: number, h: number): CSSProperties {
  return {
    left: `${(x / PLAN_W) * 100}%`,
    top: `${(y / PLAN_H) * 100}%`,
    width: `${(w / PLAN_W) * 100}%`,
    height: `${(h / PLAN_H) * 100}%`,
  };
}

export function WarehouseFloorPlan({
  locations,
  placements,
  highlighted,
  activeCode,
  onOpenBay,
}: {
  locations: StorageLocation[];
  placements: MaterialPlacement[];
  highlighted: Set<string> | null;
  activeCode: string | null;
  onOpenBay: (bay: string) => void;
}) {
  const stats = statsByBay(locations, placements, highlighted);

  return (
    <div className="overflow-x-auto" data-testid="warehouse-plan">
      <div className="mx-auto min-w-[42rem] max-w-5xl px-8 py-6">
        <div className="relative w-full" style={{ aspectRatio: `${PLAN_W} / ${PLAN_H}` }}>
          <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[#f3f5f7] shadow-[0_12px_40px_rgba(28,49,68,0.06)] ring-1 ring-[#e7ebef]" />
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${PLAN_W}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${PLAN_H}, minmax(0, 1fr))`,
            }}
          >
            <div style={gridBox(52, 0, 5, 5)} className="relative" aria-label="水管区">
              <span className="absolute inset-[12%] flex items-center justify-center rounded-2xl border border-dashed border-[#8ec4e0] bg-[#d7f0fb] px-0.5 text-center text-[10px] font-medium leading-tight text-[#2f6480] sm:text-xs">
                水管区
              </span>
            </div>
            {RACKS.map((rack) => {
              const stat = stats.get(rack.bay);
              return (
                <PlanBay
                  key={rack.bay}
                  rack={rack}
                  stat={stat}
                  dimmed={highlighted != null && !stat?.hit && !stat?.codes.includes(activeCode ?? "")}
                  pinned={activeCode != null && (stat?.codes.includes(activeCode) ?? false)}
                  onOpen={() => onOpenBay(rack.bay)}
                />
              );
            })}
          </div>
          <Aisles />
          <WallDoor label="逃生门" x={-1.7} y={6} w={3.6} h={3.8} testId="emergency-door" />
          <WallDoor label="卷帘门" x={45} y={27.45} w={7} h={3.15} testId="roller-door" />
        </div>
      </div>
    </div>
  );
}

function PlanBay({
  rack,
  stat,
  dimmed,
  pinned,
  onOpen,
}: {
  rack: RackSpec;
  stat: BayStat | undefined;
  dimmed: boolean;
  pinned: boolean;
  onOpen: () => void;
}) {
  const count = stat?.count ?? 0;
  const filled = count > 0;
  const shelf = rack.kind === "shelf";
  const narrow = rack.w <= 3;
  const label = shelf ? rack.bay : `${rack.bay}格`;
  const hit = stat?.hit ?? false;
  return (
    <button
      type="button"
      style={gridBox(rack.x, rack.y, rack.w, rack.h)}
      data-bay={rack.bay}
      onClick={onOpen}
      aria-label={`${label}，${stat?.zone ?? "货架"}，${count} 个物料`}
      className={cn(
        "relative flex items-center justify-center bg-transparent focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f78]",
        dimmed && "opacity-40",
      )}
    >
      <span
        className={cn(
          "absolute overflow-hidden shadow-[0_8px_18px_rgba(28,49,68,0.08)]",
          narrow ? "inset-x-[12%] inset-y-[5%] rounded-xl" : "inset-x-[8%] inset-y-[13%] rounded-2xl",
          shelf ? (filled ? "bg-[#8eabc2]" : "bg-[#d5e3ee]") : filled ? "bg-[#f0a04b]" : "bg-[#ffe3c4]",
          pinned && "ring-2 ring-[#143044]",
          !pinned && hit && "ring-2 ring-[#1f5f78]",
        )}
      >
        {rack.kind === "pallet" ? <ColumnSplit along={rack.along ?? "h"} cols={stat?.cols ?? new Set()} /> : null}
      </span>
      <BayBadge bay={rack.bay} count={count} shelf={shelf} narrow={narrow} />
      {stat?.codes.map((code) => (
        <span key={code} data-location-code={code} className="sr-only" aria-hidden>
          {code}
        </span>
      ))}
    </button>
  );
}

function BayBadge({ bay, count, shelf, narrow }: { bay: string; count: number; shelf: boolean; narrow: boolean }) {
  const circle = shelf ? "bg-[#eef4f8] text-[#3d5a73]" : "bg-[#fff6ee] text-[#c56a1a]";
  if (narrow) {
    return (
      <span className="relative z-[1] flex flex-col items-center gap-0.5">
        <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold shadow-md ring-1 ring-black/5", circle)}>
          {bay}
        </span>
        <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold text-[#1c3144] tabular-nums shadow-sm">{count}</span>
      </span>
    );
  }
  return (
    <span className="relative z-[1] inline-flex items-center gap-1 rounded-full bg-white py-0.5 pr-1.5 pl-0.5 shadow-md ring-1 ring-black/5">
      <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-bold", circle)}>{bay}</span>
      <span className="min-w-3 text-center text-[11px] font-semibold text-[#1c3144] tabular-nums">{count}</span>
    </span>
  );
}

function ColumnSplit({ along, cols }: { along: "h" | "v"; cols: Set<number> }) {
  const first = cols.has(1);
  const second = cols.has(2);
  if (along === "v") {
    return (
      <span className="pointer-events-none absolute inset-0 grid grid-rows-2">
        <span className={cn(first && "bg-black/10")} />
        <span className={cn("border-t border-white/70", second && "bg-black/10")} />
      </span>
    );
  }
  return (
    <span className="pointer-events-none absolute inset-0 grid grid-cols-2">
      <span className={cn(first && "bg-black/10")} />
      <span className={cn("border-l border-white/70", second && "bg-black/10")} />
    </span>
  );
}

function Aisles() {
  return (
    <svg
      viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      role="img"
      aria-label="叉车通道"
      data-testid="forklift-aisles"
    >
      <defs>
        <marker id="aisle-end" markerUnits="userSpaceOnUse" markerWidth="2.5" markerHeight="2.2" refX="2.2" refY="1.1" orient="auto">
          <path d="M0,0 L2.5,1.1 L0,2.2 Z" fill="#2f9d57" />
        </marker>
        <marker
          id="aisle-start"
          markerUnits="userSpaceOnUse"
          markerWidth="2.5"
          markerHeight="2.2"
          refX="0.3"
          refY="1.1"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L2.5,1.1 L0,2.2 Z" fill="#2f9d57" />
        </marker>
      </defs>
      <line
        data-testid="aisle-horizontal"
        x1="4.4"
        y1="6.7"
        x2="46"
        y2="6.7"
        stroke="#d9f3e4"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="1.15 0.7"
      />
      <line
        x1="4.4"
        y1="6.7"
        x2="46"
        y2="6.7"
        stroke="#2f9d57"
        strokeWidth="0.62"
        strokeLinecap="round"
        markerStart="url(#aisle-start)"
        markerEnd="url(#aisle-end)"
      />
      <line
        data-testid="aisle-vertical"
        x1="50.6"
        y1="8"
        x2="50.6"
        y2="25.4"
        stroke="#d9f3e4"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="1.15 0.7"
      />
      <line
        x1="50.6"
        y1="8"
        x2="50.6"
        y2="25.4"
        stroke="#2f9d57"
        strokeWidth="0.62"
        strokeLinecap="round"
        markerStart="url(#aisle-start)"
        markerEnd="url(#aisle-end)"
      />
    </svg>
  );
}

function WallDoor({ label, x, y, w, h, testId }: { label: string; x: number; y: number; w: number; h: number; testId: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      data-testid={testId}
      className="absolute z-20 flex items-center justify-center rounded-lg border border-[#c5d0d8] text-[10px] font-medium whitespace-nowrap text-[#3d4c5c] shadow-sm sm:text-xs"
      style={{
        ...percentBox(x, y, w, h),
        backgroundImage: "repeating-linear-gradient(#d5dee6, #d5dee6 3px, #eef3f6 3px, #eef3f6 7px)",
      }}
    >
      <span className="bg-[#e8eef2]/90 px-0.5">{label}</span>
    </div>
  );
}
