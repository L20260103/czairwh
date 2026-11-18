import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  createId,
  postMovement,
  removeMaterial,
  saveMaterial,
} from "@/lib/inventory/inventory";
import { createSampleState } from "@/lib/inventory/sampleData";
import { loadState, saveState, type StateSource } from "@/lib/inventory/storage";
import type { InventoryState, Material, MaterialDraft, MaterialErrors, Movement, MovementDraft, MovementErrors } from "@/lib/inventory/types";

export interface InventoryContextValue {
  /** localStorage 已读完。 */
  ready: boolean;
  /** 每次「重置示例数据」加 1，用来让表单重新挂载。 */
  epoch: number;
  state: InventoryState;
  source: StateSource;
  persistError: string | null;
  postMovement: (draft: MovementDraft) => { ok: true; movement: Movement } | { ok: false; errors: MovementErrors };
  saveMaterial: (
    draft: MaterialDraft,
    id?: string,
  ) => { ok: true; material: Material } | { ok: false; errors: MaterialErrors };
  removeMaterial: (id: string) => { ok: true } | { ok: false; error: string };
  resetDemo: () => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [state, setState] = useState<InventoryState>(() => createSampleState());
  const [source, setSource] = useState<StateSource>("empty");
  const [persistError, setPersistError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const loaded = loadState();
    stateRef.current = loaded.state;
    setState(loaded.state);
    setSource(loaded.source);
    if (loaded.error) {
      setPersistError(loaded.error);
    } else if (loaded.source === "empty") {
      const saved = saveState(loaded.state);
      setPersistError(saved.ok ? null : saved.error);
      if (saved.ok) setSource("saved");
    }
    setReady(true);
  }, []);

  const value = useMemo<InventoryContextValue>(() => {
    const commit = (next: InventoryState) => {
      stateRef.current = next;
      setState(next);
      const saved = saveState(next);
      setPersistError(saved.ok ? null : saved.error);
      if (saved.ok) setSource("saved");
    };
    return {
      ready,
      epoch,
      state,
      source,
      persistError,
      postMovement: (draft) => {
        const result = postMovement(stateRef.current, draft, {
          id: createId("mv"),
          at: new Date().toISOString(),
          sample: false,
        });
        if (!result.ok) return result;
        commit(result.state);
        return { ok: true, movement: result.movement };
      },
      saveMaterial: (draft, id) => {
        const materialId = id ?? createId("mat");
        const result = saveMaterial(stateRef.current, draft, { id: materialId, now: new Date().toISOString() });
        if (!result.ok) return result;
        commit(result.state);
        return { ok: true, material: result.material };
      },
      removeMaterial: (id) => {
        const result = removeMaterial(stateRef.current, id);
        if (!result.ok) return result;
        commit(result.state);
        return { ok: true };
      },
      resetDemo: () => {
        commit(createSampleState());
        setEpoch((n) => n + 1);
      },
    };
  }, [epoch, persistError, ready, source, state]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("库存数据还没有准备好。");
  return context;
}
