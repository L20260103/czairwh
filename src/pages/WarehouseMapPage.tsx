import { useEffect, useMemo, useRef, useState } from "react";

import { BaySheet } from "@/components/BaySheet";
import { EmptyState, PageHeader } from "@/components/common";
import { StickyToolbar } from "@/components/StickyToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarehouseFloorPlan } from "@/components/WarehouseFloorPlan";
import { materialMatchesQuery } from "@/lib/inventory/locations";
import { replaceSearchParams, useSearchParams } from "@/lib/router";
import { useInventory } from "@/store/InventoryProvider";
import { useLocations } from "@/store/LocationProvider";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setDesktop(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

/** 仓库地图（#/map）。搜索串 q 标出物料，loc 打开对应货架。 */
export function WarehouseMapPage() {
  const params = useSearchParams();
  const queryParam = params.get("q") ?? "";
  const loc = params.get("loc") ?? "";
  const { state } = useInventory();
  const { ready, error, locations, placements, reload } = useLocations();
  const desktop = useIsDesktop();
  const [searchInput, setSearchInput] = useState(queryParam);
  const [openBay, setOpenBay] = useState<string | null>(null);
  const writtenQuery = useRef<string | null>(null);
  const seenLoc = useRef<string | null>(null);

  useEffect(() => {
    if (writtenQuery.current === null) {
      writtenQuery.current = queryParam;
      return;
    }
    if (queryParam === writtenQuery.current) return;
    writtenQuery.current = queryParam;
    setSearchInput(queryParam);
  }, [queryParam]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === writtenQuery.current) return;
      writtenQuery.current = next;
      replaceSearchParams((nextParams) => {
        if (next) nextParams.set("q", next);
        else nextParams.delete("q");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!loc) {
      seenLoc.current = null;
      return;
    }
    if (seenLoc.current === loc) return;
    const found = locations.find((location) => location.code === loc);
    if (!found) return;
    seenLoc.current = loc;
    setOpenBay(found.bay);
  }, [loc, locations]);

  useEffect(() => {
    if (!openBay) return;
    document.querySelector(`[data-bay="${openBay}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [openBay]);

  const highlighted = useMemo(() => {
    const needle = queryParam.trim();
    if (!needle) return null;
    const ids = new Set(state.materials.filter((material) => materialMatchesQuery(material, needle)).map((material) => material.id));
    const codes = new Set<string>();
    for (const placement of placements) {
      if (ids.has(placement.materialId)) codes.add(placement.locationCode);
    }
    return codes;
  }, [placements, queryParam, state.materials]);

  function closeBay() {
    setOpenBay(null);
    replaceSearchParams((nextParams) => nextParams.delete("loc"));
  }

  return (
    <div data-testid="warehouse-map" data-location-count={ready ? locations.length : undefined}>
      <PageHeader title="仓库地图">点货架查看每一层。搜索名称或 SKU 时，放着该物料的货位会标出来。</PageHeader>
      <StickyToolbar>
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="搜索物料名称或 SKU"
          aria-label="在仓库地图上搜索物料"
          data-testid="warehouse-search"
          className="h-11 bg-white"
        />
        {queryParam.trim() ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {highlighted && highlighted.size > 0 ? `平面图上有 ${highlighted.size} 个货位` : "没有货位放着这个物料"}
          </p>
        ) : null}
      </StickyToolbar>

      {!ready ? <p className="text-sm text-muted-foreground">正在读取货位…</p> : null}
      {ready && error && locations.length === 0 ? (
        <EmptyState title="没能读取仓库地图">
          <p>{error}</p>
          <Button type="button" variant="outline" className="mt-3 h-10 bg-white" onClick={() => reload()}>
            重试
          </Button>
        </EmptyState>
      ) : null}
      {ready && locations.length > 0 ? (
        <>
          <p className="mb-2 text-sm text-[#1c3144]" data-testid="warehouse-location-count">
            共 {locations.length} 个货位
          </p>
          <WarehouseFloorPlan
            locations={locations}
            placements={placements}
            highlighted={highlighted}
            activeCode={loc || null}
            onOpenBay={setOpenBay}
          />
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            圆标是货架编号和物料数。橙色是托盘货架，灰蓝是小货架，绿色箭头是叉车通道，浅蓝是水管区。蓝框是搜索命中。
          </p>
        </>
      ) : null}

      {openBay ? (
        <BaySheet
          key={openBay}
          bay={openBay}
          locations={locations}
          placements={placements}
          highlighted={highlighted}
          activeCode={loc || null}
          desktop={desktop}
          onClose={closeBay}
        />
      ) : null}
    </div>
  );
}
