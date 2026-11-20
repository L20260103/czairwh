import type { MaterialPlacement, StorageLocation } from "@/lib/inventory/locations";
import { supabase } from "@/lib/supabase/client";

const LOCATION_COLUMNS = "code, zone, bay, col, level, sort, notes";
const PLACEMENT_COLUMNS = "id, material_id, location_code, notes, created_at";

type DbError = { message: string; code?: string };
type Page<T> = { data: T[] | null; error: DbError | null };

export type LocationFailure = { ok: false; error: string };

const NOTE_LIMIT = 80;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error(`共享货位里有一条无法识别的${label}。`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`共享货位里的${label}无效。`);
  return value;
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error("共享货位里有一条备注无法识别。");
  return value;
}

function asInt(value: unknown, label: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number)) throw new Error(`共享货位里的${label}无效。`);
  return number;
}

function asNullableInt(value: unknown): number | null {
  if (value == null) return null;
  return asInt(value, "列");
}

function mapLocation(value: unknown): StorageLocation {
  const row = asRecord(value, "货位");
  return {
    code: asString(row.code, "货位编号"),
    zone: asString(row.zone, "货区"),
    bay: asString(row.bay, "货架"),
    col: asNullableInt(row.col),
    level: asInt(row.level, "层"),
    sort: asInt(row.sort, "排序"),
    notes: asText(row.notes),
  };
}

function mapPlacement(value: unknown): MaterialPlacement {
  const row = asRecord(value, "存放记录");
  return {
    id: asString(row.id, "存放记录"),
    materialId: asString(row.material_id, "物料"),
    locationCode: asString(row.location_code, "货位编号"),
    notes: asText(row.notes).trim(),
    createdAt: asString(row.created_at, "时间"),
  };
}

async function fetchAll<T>(loadPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<Page<T>> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await loadPage(from, from + 999);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return { data: rows, error: null };
    from += 1000;
  }
}

function failure(error: DbError, fallback: string): LocationFailure {
  if (error.code === "23505") return { ok: false, error: "这个物料已经在这个货位上。" };
  if (error.code === "23503") return { ok: false, error: "货位或物料不存在。" };
  const message = error.message?.trim();
  return { ok: false, error: message ? `${fallback}（${message}）` : fallback };
}

export async function loadWarehouseMap(): Promise<
  { ok: true; locations: StorageLocation[]; placements: MaterialPlacement[] } | LocationFailure
> {
  const [locations, placements] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("storage_locations").select(LOCATION_COLUMNS).order("sort").order("code").range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("material_locations").select(PLACEMENT_COLUMNS).order("created_at").order("id").range(from, to),
    ),
  ]);
  const error = locations.error ?? placements.error;
  if (error) return failure(error, "没能读取仓库地图");
  try {
    return {
      ok: true,
      locations: (locations.data ?? []).map(mapLocation),
      placements: (placements.data ?? []).map(mapPlacement),
    };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "仓库地图里的数据无法识别。" };
  }
}

export function normalizePlacementNote(notes: string): { ok: true; notes: string } | LocationFailure {
  const text = notes.trim().replace(/\s+/g, " ");
  if (text.length > NOTE_LIMIT) return { ok: false, error: `备注最多 ${NOTE_LIMIT} 个字。` };
  return { ok: true, notes: text };
}

export async function insertPlacement(input: {
  materialId: string;
  locationCode: string;
  notes: string;
}): Promise<{ ok: true; placement: MaterialPlacement } | LocationFailure> {
  const note = normalizePlacementNote(input.notes);
  if (!note.ok) return note;
  const { data, error } = await supabase
    .from("material_locations")
    .insert({
      material_id: input.materialId,
      location_code: input.locationCode,
      notes: note.notes || null,
    })
    .select(PLACEMENT_COLUMNS)
    .single();
  if (error) return failure(error, "没能放入这个货位");
  try {
    return { ok: true, placement: mapPlacement(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "放入之后的返回数据无法识别。" };
  }
}

export async function deletePlacement(id: string): Promise<{ ok: true } | LocationFailure> {
  const { error } = await supabase.from("material_locations").delete().eq("id", id);
  if (error) return failure(error, "没能移出这个货位");
  return { ok: true };
}
