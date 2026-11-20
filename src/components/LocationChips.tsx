import { Link } from "@/lib/router";
import { useLocations } from "@/store/LocationProvider";

/** 物料所在的货位编号。点一下跳到仓库地图并标出该货位。没有记录时目录里不占位置。 */
export function LocationChips({ materialId, emptyLabel }: { materialId: string; emptyLabel?: string }) {
  const { ready, error, locations, placements } = useLocations();
  if (!ready || error) return null;
  const sortOf = new Map(locations.map((location) => [location.code, location.sort]));
  const codes = placements
    .filter((placement) => placement.materialId === materialId)
    .map((placement) => placement.locationCode)
    .sort((a, b) => (sortOf.get(a) ?? 0) - (sortOf.get(b) ?? 0) || a.localeCompare(b));
  if (codes.length === 0) {
    return emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null;
  }
  return (
    <ul className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <li key={code}>
          <Link
            href={`/map?loc=${encodeURIComponent(code)}`}
            className="inline-flex rounded-full bg-[#fff4e8] px-2 py-0.5 text-[11px] font-medium text-[#8a4b16] ring-1 ring-[#e7c39a] hover:ring-[#c4844a]"
          >
            {code}
          </Link>
        </li>
      ))}
    </ul>
  );
}
