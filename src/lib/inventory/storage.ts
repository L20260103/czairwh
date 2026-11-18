import { createSampleState } from "./sampleData";
import type { InventoryState, Material, Movement, MovementType } from "./types";
import { isUnitCode } from "./units";

/** localStorage 键名。 */
export const STORAGE_KEY = "coolzone.hvac.prototype.v1";

export const STORAGE_UNAVAILABLE_MESSAGE =
  "这台浏览器没有把试用账写进本地存储。用文件预览或 iPad 快速查看打开时经常如此，浏览器也可能禁止了本地文件的存储。现在仍可以入库、出库、看流水和导出 CSV，但刷新或关掉页面后，新记的账会消失。请先导出 CSV。";

/** empty = 第一次打开；saved = 读到已保存的数据；corrupt = 数据损坏，已换回示例；unavailable = 浏览器不让存。 */
export type StateSource = "empty" | "saved" | "corrupt" | "unavailable";

function isMovementType(value: unknown): value is MovementType {
  return value === "receipt" || value === "issue" || value === "return";
}

function isMaterial(value: unknown): value is Material {
  if (!value || typeof value != "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id == "string" &&
    m.id.length > 0 &&
    typeof m.sku == "string" &&
    typeof m.name == "string" &&
    typeof m.category == "string" &&
    typeof m.unit == "string" &&
    isUnitCode(m.unit) &&
    typeof m.location == "string" &&
    typeof m.minStock == "number" &&
    Number.isFinite(m.minStock) &&
    m.minStock >= 0 &&
    typeof m.active == "boolean" &&
    typeof m.note == "string" &&
    typeof m.sample == "boolean" &&
    typeof m.createdAt == "string"
  );
}

function isMovement(value: unknown, materialIds: Set<string>): value is Movement {
  if (!value || typeof value != "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id == "string" &&
    m.id.length > 0 &&
    typeof m.at == "string" &&
    Number.isFinite(Date.parse(m.at)) &&
    isMovementType(m.type) &&
    typeof m.materialId == "string" &&
    materialIds.has(m.materialId) &&
    typeof m.quantity == "number" &&
    Number.isFinite(m.quantity) &&
    m.quantity > 0 &&
    typeof m.beforeQty == "number" &&
    Number.isFinite(m.beforeQty) &&
    typeof m.afterQty == "number" &&
    Number.isFinite(m.afterQty) &&
    typeof m.operator == "string" &&
    typeof m.jobNumber == "string" &&
    typeof m.recipient == "string" &&
    typeof m.reference == "string" &&
    typeof m.notes == "string" &&
    typeof m.sample == "boolean"
  );
}

function isInventoryState(value: unknown): value is InventoryState {
  if (!value || typeof value != "object") return false;
  const s = value as Record<string, unknown>;
  if (
    s.version !== 1 ||
    !Array.isArray(s.materials) ||
    !Array.isArray(s.movements) ||
    typeof s.lastOperator != "string" ||
    !s.materials.every(isMaterial)
  )
    return false;
  const materialIds = (s.materials as Material[]).map((m) => m.id);
  if (new Set(materialIds).size !== materialIds.length) return false;
  const idSet = new Set(materialIds);
  if (!s.movements.every((m) => isMovement(m, idSet))) return false;
  const movementIds = (s.movements as Movement[]).map((m) => m.id);
  return new Set(movementIds).size === movementIds.length;
}

function parseStored(raw: string | null): { state: InventoryState; source: StateSource } {
  if (raw == null || raw.trim() === "") return { state: createSampleState(), source: "empty" };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isInventoryState(parsed)
      ? { state: parsed, source: "saved" }
      : { state: createSampleState(), source: "corrupt" };
  } catch {
    return { state: createSampleState(), source: "corrupt" };
  }
}

export interface LoadResult {
  state: InventoryState;
  source: StateSource;
  error: string | null;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

function readFrom(storage: Storage): LoadResult {
  try {
    return { ...parseStored(storage.getItem(STORAGE_KEY)), error: null };
  } catch {
    return { state: createSampleState(), source: "unavailable", error: STORAGE_UNAVAILABLE_MESSAGE };
  }
}

function writeTo(storage: Storage, state: InventoryState): SaveResult {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "浏览器存储空间已满。请先导出 CSV。当前页面里的账还在，刷新后可能丢失。"
          : STORAGE_UNAVAILABLE_MESSAGE,
    };
  }
}

export function loadState(): LoadResult {
  if (typeof window === "undefined") return { state: createSampleState(), source: "empty", error: null };
  try {
    return readFrom(window.localStorage);
  } catch {
    return { state: createSampleState(), source: "unavailable", error: STORAGE_UNAVAILABLE_MESSAGE };
  }
}

export function saveState(state: InventoryState): SaveResult {
  if (typeof window === "undefined") return { ok: false, error: "当前环境没有浏览器存储。" };
  try {
    return writeTo(window.localStorage, state);
  } catch {
    return { ok: false, error: STORAGE_UNAVAILABLE_MESSAGE };
  }
}
