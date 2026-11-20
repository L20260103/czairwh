import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { MaterialPlacement, StorageLocation } from "@/lib/inventory/locations";
import { deletePlacement, insertPlacement, loadWarehouseMap } from "@/lib/inventory/locationsRemote";

interface LocationContextValue {
  ready: boolean;
  error: string | null;
  locations: StorageLocation[];
  placements: MaterialPlacement[];
  reload: () => void;
  addPlacement: (input: {
    materialId: string;
    locationCode: string;
    notes: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  removePlacement: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [placements, setPlacements] = useState<MaterialPlacement[]>([]);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const token = ++revision.current;
    let result: Awaited<ReturnType<typeof loadWarehouseMap>>;
    try {
      result = await loadWarehouseMap();
    } catch (caught) {
      result = { ok: false, error: caught instanceof Error ? caught.message : "没能读取仓库地图。" };
    }
    if (token !== revision.current) return;
    if (!result.ok) {
      setError(result.error);
      setReady(true);
      return;
    }
    setLocations(result.locations);
    setPlacements(result.placements);
    setError(null);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const value = useMemo<LocationContextValue>(
    () => ({
      ready,
      error,
      locations,
      placements,
      reload: () => {
        void refresh();
      },
      addPlacement: async (input) => {
        const saved = await insertPlacement(input);
        if (!saved.ok) return saved;
        await refresh();
        return { ok: true };
      },
      removePlacement: async (id) => {
        const saved = await deletePlacement(id);
        if (!saved.ok) return saved;
        await refresh();
        return { ok: true };
      },
    }),
    [error, locations, placements, ready, refresh],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocations(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error("仓库地图还没有准备好。");
  return context;
}
