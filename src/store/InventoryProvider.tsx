import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  categoryDeleteError,
  supplierDeleteError,
  validateCategory,
  validateEmployeeName,
  validateSupplier,
} from "@/lib/inventory/catalog";
import { createEmptyState, createId, postMovement, removeMaterial, saveMaterial, validateMovementText } from "@/lib/inventory/inventory";
import {
  deleteCategory,
  deleteMaterial,
  deleteSupplier,
  insertCategory,
  insertEmployee,
  insertMaterial,
  insertMovement,
  insertSupplier,
  loadRemoteState,
  rememberOperator,
  replaceMaterialOffers,
  updateCategory,
  updateEmployee,
  updateMaterial,
  updateMovementText,
  updateSupplier,
} from "@/lib/inventory/remote";
import { supabase } from "@/lib/supabase/client";
import type {
  Category,
  CategoryDraft,
  CategoryErrors,
  Employee,
  EmployeeErrors,
  InventoryState,
  Material,
  MaterialDraft,
  MaterialErrors,
  Movement,
  MovementDraft,
  MovementErrors,
  MovementTextDraft,
  MovementTextErrors,
  Supplier,
  SupplierDraft,
  SupplierErrors,
  SupplierOfferInput,
  SupplierProduct,
} from "@/lib/inventory/types";

export interface InventoryContextValue {
  ready: boolean;
  loadError: string | null;
  state: InventoryState;
  persistError: string | null;
  reload: () => void;
  postMovement: (draft: MovementDraft) => Promise<{ ok: true; movement: Movement } | { ok: false; errors: MovementErrors }>;
  saveMovementText: (
    id: string,
    draft: MovementTextDraft,
  ) => Promise<{ ok: true; movement: Movement } | { ok: false; errors: MovementTextErrors }>;
  saveMaterial: (
    draft: MaterialDraft,
    offers: SupplierOfferInput[],
    id?: string,
  ) => Promise<{ ok: true; material: Material } | { ok: false; errors: MaterialErrors; materialId?: string }>;
  removeMaterial: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveCategory: (
    draft: CategoryDraft,
    id?: string,
  ) => Promise<{ ok: true; category: Category } | { ok: false; errors: CategoryErrors }>;
  removeCategory: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveSupplier: (
    draft: SupplierDraft,
    id?: string,
  ) => Promise<{ ok: true; supplier: Supplier } | { ok: false; errors: SupplierErrors }>;
  removeSupplier: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveEmployee: (
    name: string,
    id?: string,
  ) => Promise<{ ok: true; employee: Employee } | { ok: false; errors: EmployeeErrors }>;
  setEmployeeActive: (id: string, active: boolean) => Promise<{ ok: true; employee: Employee } | { ok: false; error: string }>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

const REALTIME_TABLES = ["categories", "materials", "suppliers", "supplier_products", "stock_movements", "app_settings"] as const;

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [state, setState] = useState<InventoryState>(() => createEmptyState());
  const stateRef = useRef(state);
  const revision = useRef(0);
  const hasLoaded = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  stateRef.current = state;

  // 首次打开、realtime、回到页面，都重新调用 loadRemoteState。分页只写在那一个函数里。
  const refresh = useCallback(async () => {
    const token = ++revision.current;
    let result: Awaited<ReturnType<typeof loadRemoteState>>;
    try {
      result = await loadRemoteState();
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : "没能读取共享库存。" };
    }
    if (token !== revision.current) return;
    if (!result.ok) {
      if (hasLoaded.current) setPersistError(`暂时没能刷新共享库存，页面上仍是上次读到的内容。${result.error}`);
      else setLoadError(result.error);
      setReady(true);
      return;
    }
    hasLoaded.current = true;
    stateRef.current = result.state;
    setState(result.state);
    setLoadError(null);
    setPersistError(null);
    setReady(true);
  }, []);

  const commit = useCallback(
    (next: InventoryState) => {
      stateRef.current = next;
      setState(next);
      setPersistError(null);
      void refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
    const schedule = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void refresh();
      }, 200);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase.channel("coolzone-inventory");
    for (const table of REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe();
    return () => {
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo<InventoryContextValue>(() => {
    return {
      ready,
      loadError,
      state,
      persistError,
      reload: () => {
        void refresh();
      },
      postMovement: async (draft) => {
        const result = postMovement(stateRef.current, draft, { id: createId(), at: new Date().toISOString() });
        if (!result.ok) return result;
        const saved = await insertMovement(result.movement);
        if (!saved.ok) {
          setPersistError(saved.error);
          return { ok: false, errors: { form: saved.error } };
        }
        const remembered = await rememberOperator(result.state.lastOperator);
        if (!remembered.ok) setPersistError(`流水已记下，但没能记住操作人。${remembered.error}`);
        commit(result.state);
        return { ok: true, movement: result.movement };
      },
      saveMovementText: async (id, draft) => {
        const existing = stateRef.current.movements.find((movement) => movement.id === id);
        if (!existing) return { ok: false, errors: { form: "这笔流水已经不在列表里。" } };
        const result = validateMovementText(existing.type, draft);
        if (!result.ok) return result;
        const saved = await updateMovementText(id, result.value);
        if (!saved.ok) return { ok: false, errors: { form: saved.error } };
        const movements = stateRef.current.movements.map((movement) =>
          movement.id === saved.movement.id ? saved.movement : movement,
        );
        commit({ ...stateRef.current, movements });
        return { ok: true, movement: saved.movement };
      },
      saveMaterial: async (draft, offers, id) => {
        const materialId = id ?? createId();
        const result = saveMaterial(stateRef.current, draft, { id: materialId, now: new Date().toISOString() });
        if (!result.ok) return result;
        const existed = stateRef.current.materials.some((material) => material.id === materialId);
        const saved = existed ? await updateMaterial(result.material) : await insertMaterial(result.material);
        if (!saved.ok) {
          if (saved.error === "SKU 已存在。") return { ok: false, errors: { sku: saved.error } };
          return { ok: false, errors: { form: saved.error } };
        }
        const previous = stateRef.current.supplierProducts.filter((offer) => offer.materialId === saved.material.id);
        const now = new Date().toISOString();
        const nextOffers: SupplierProduct[] = offers.map((offer) => ({
          id: offer.id ?? createId(),
          materialId: saved.material.id,
          supplierId: offer.supplierId,
          supplierCode: offer.supplierCode,
          supplierProductName: offer.supplierProductName,
          priceExGst: offer.priceExGst,
          currency: "AUD",
          notes: offer.notes,
          updatedAt: now,
        }));
        const offersSaved = await replaceMaterialOffers(saved.material.id, nextOffers, previous);
        const materials = existed
          ? stateRef.current.materials.map((material) => (material.id === saved.material.id ? saved.material : material))
          : [...stateRef.current.materials, saved.material];
        const supplierProducts = [
          ...stateRef.current.supplierProducts.filter((offer) => offer.materialId !== saved.material.id),
          ...(offersSaved.ok ? nextOffers : previous),
        ];
        commit({ ...stateRef.current, materials, supplierProducts });
        if (!offersSaved.ok) {
          return { ok: false, errors: { offers: `物料已保存，但报价没写完。${offersSaved.error}` }, materialId: saved.material.id };
        }
        return { ok: true, material: saved.material };
      },
      removeMaterial: async (id) => {
        const result = removeMaterial(stateRef.current, id);
        if (!result.ok) return result;
        const offers = stateRef.current.supplierProducts.filter((offer) => offer.materialId === id);
        if (offers.length > 0) {
          const cleared = await replaceMaterialOffers(id, [], offers);
          if (!cleared.ok) return { ok: false, error: cleared.error };
        }
        const saved = await deleteMaterial(id);
        if (!saved.ok) return { ok: false, error: saved.error };
        commit({
          ...result.state,
          supplierProducts: stateRef.current.supplierProducts.filter((offer) => offer.materialId !== id),
        });
        return { ok: true };
      },
      saveCategory: async (draft, id) => {
        const categoryId = id ?? createId();
        const result = validateCategory(stateRef.current.categories, draft, id);
        if (!result.ok) return result;
        const existing = stateRef.current.categories.find((category) => category.id === categoryId);
        const category: Category = {
          id: categoryId,
          nameZh: result.value.nameZh,
          nameEn: result.value.nameEn,
          parentId: result.value.parentId,
          sortOrder: result.value.sortOrder,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        const saved = existing ? await updateCategory(category) : await insertCategory(category);
        if (!saved.ok) return { ok: false, errors: { form: saved.error } };
        const categories = existing
          ? stateRef.current.categories.map((item) => (item.id === saved.category.id ? saved.category : item))
          : [...stateRef.current.categories, saved.category];
        commit({ ...stateRef.current, categories });
        return { ok: true, category: saved.category };
      },
      removeCategory: async (id) => {
        const error = categoryDeleteError(stateRef.current.categories, stateRef.current.materials, id);
        if (error) return { ok: false, error };
        const saved = await deleteCategory(id);
        if (!saved.ok) return saved;
        commit({ ...stateRef.current, categories: stateRef.current.categories.filter((category) => category.id !== id) });
        return { ok: true };
      },
      saveSupplier: async (draft, id) => {
        const supplierId = id ?? createId();
        const result = validateSupplier(stateRef.current.suppliers, draft, id);
        if (!result.ok) return result;
        const existing = stateRef.current.suppliers.find((supplier) => supplier.id === supplierId);
        const supplier: Supplier = {
          id: supplierId,
          ...result.value,
          updatedAt: new Date().toISOString(),
        };
        const saved = existing ? await updateSupplier(supplier) : await insertSupplier(supplier);
        if (!saved.ok) return { ok: false, errors: { form: saved.error } };
        const suppliers = existing
          ? stateRef.current.suppliers.map((item) => (item.id === saved.supplier.id ? saved.supplier : item))
          : [...stateRef.current.suppliers, saved.supplier];
        commit({ ...stateRef.current, suppliers });
        return { ok: true, supplier: saved.supplier };
      },
      removeSupplier: async (id) => {
        const error = supplierDeleteError(
          stateRef.current.suppliers,
          stateRef.current.supplierProducts,
          stateRef.current.movements,
          id,
        );
        if (error) return { ok: false, error };
        const saved = await deleteSupplier(id);
        if (!saved.ok) return saved;
        commit({ ...stateRef.current, suppliers: stateRef.current.suppliers.filter((supplier) => supplier.id !== id) });
        return { ok: true };
      },
      saveEmployee: async (name, id) => {
        const result = validateEmployeeName(stateRef.current.employees, name, id);
        if (!result.ok) return result;
        if (id) {
          const existing = stateRef.current.employees.find((employee) => employee.id === id);
          if (!existing) return { ok: false, errors: { form: "找不到要修改的员工。" } };
          const saved = await updateEmployee({ ...existing, name: result.name });
          if (!saved.ok) return { ok: false, errors: { form: saved.error } };
          const employees = stateRef.current.employees.map((employee) =>
            employee.id === saved.employee.id ? saved.employee : employee,
          );
          commit({ ...stateRef.current, employees });
          return { ok: true, employee: saved.employee };
        }
        const sortOrder = stateRef.current.employees.reduce((max, employee) => Math.max(max, employee.sortOrder), 0) + 1;
        const saved = await insertEmployee({
          id: createId(),
          name: result.name,
          active: true,
          sortOrder,
          createdAt: new Date().toISOString(),
        });
        if (!saved.ok) return { ok: false, errors: { form: saved.error } };
        commit({ ...stateRef.current, employees: [...stateRef.current.employees, saved.employee] });
        return { ok: true, employee: saved.employee };
      },
      setEmployeeActive: async (id, active) => {
        const existing = stateRef.current.employees.find((employee) => employee.id === id);
        if (!existing) return { ok: false, error: "找不到要修改的员工。" };
        if (existing.active === active) return { ok: true, employee: existing };
        const saved = await updateEmployee({ ...existing, active });
        if (!saved.ok) return { ok: false, error: saved.error };
        const employees = stateRef.current.employees.map((employee) =>
          employee.id === saved.employee.id ? saved.employee : employee,
        );
        commit({ ...stateRef.current, employees });
        return { ok: true, employee: saved.employee };
      },
    };
  }, [commit, loadError, persistError, ready, refresh, state]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("库存数据还没有准备好。");
  return context;
}
