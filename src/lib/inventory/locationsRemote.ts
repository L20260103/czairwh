import { formatQty, fromCents, toCents } from "@/lib/inventory/inventory";
import type { MaterialPlacement, StorageLocation } from "@/lib/inventory/locations";
import { supabase } from "@/lib/supabase/client";

const LOCATION_COLUMNS = "code, zone, bay, col, level, sort, notes";
const PLACEMENT_COLUMNS = "id, material_id, location_code, quantity, notes, created_at";

const refreshers = new Set<() => void>();

/** 货位数量改完后通知地图重新读。 */
export function subscribeLocationRefresh(listener: () => void): () => void {
  refreshers.add(listener);
  return () => refreshers.delete(listener);
}

export function notifyLocationRefresh(): void {
  refreshers.forEach((listener) => listener());
}

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

function asQty(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) throw new Error("共享货位里的数量无效。");
  return fromCents(toCents(number));
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
    quantity: asQty(row.quantity),
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

export async function fetchPlacement(
  materialId: string,
  locationCode: string,
): Promise<{ ok: true; placement: MaterialPlacement | null } | LocationFailure> {
  const { data, error } = await supabase
    .from("material_locations")
    .select(PLACEMENT_COLUMNS)
    .eq("material_id", materialId)
    .eq("location_code", locationCode)
    .maybeSingle();
  if (error) return failure(error, "没能读取这个货位的数量");
  if (!data) return { ok: true, placement: null };
  try {
    return { ok: true, placement: mapPlacement(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "货位数量无法识别。" };
  }
}

async function insertPlacementRow(input: {
  materialId: string;
  locationCode: string;
  quantity: number;
  notes: string;
}): Promise<{ ok: true; placement: MaterialPlacement } | LocationFailure> {
  const { data, error } = await supabase
    .from("material_locations")
    .insert({
      material_id: input.materialId,
      location_code: input.locationCode,
      quantity: input.quantity,
      notes: input.notes || null,
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

async function updatePlacementRow(
  id: string,
  quantity: number,
  notes: string,
): Promise<{ ok: true; placement: MaterialPlacement } | LocationFailure> {
  const { data, error } = await supabase
    .from("material_locations")
    .update({ quantity, notes: notes || null })
    .eq("id", id)
    .select(PLACEMENT_COLUMNS)
    .single();
  if (error) return failure(error, "没能改这个货位的数量");
  try {
    return { ok: true, placement: mapPlacement(data) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "改数量之后的返回数据无法识别。" };
  }
}

export async function deletePlacement(id: string): Promise<{ ok: true } | LocationFailure> {
  const { error } = await supabase.from("material_locations").delete().eq("id", id);
  if (error) return failure(error, "没能移出这个货位");
  return { ok: true };
}

/** 放入：只加货位数量，不写流水。已经在这个格子里就累加。 */
export async function placeMaterial(input: {
  materialId: string;
  locationCode: string;
  quantity: number;
  notes: string;
}): Promise<{ ok: true } | LocationFailure> {
  const note = normalizePlacementNote(input.notes);
  if (!note.ok) return note;
  if (!(input.quantity > 0)) return { ok: false, error: "放入数量必须大于 0。" };
  const existing = await fetchPlacement(input.materialId, input.locationCode);
  if (!existing.ok) return existing;
  if (!existing.placement) {
    const inserted = await insertPlacementRow({ ...input, notes: note.notes });
    return inserted.ok ? { ok: true } : inserted;
  }
  const next = fromCents(toCents(existing.placement.quantity) + toCents(input.quantity));
  const updated = await updatePlacementRow(existing.placement.id, next, note.notes || existing.placement.notes);
  return updated.ok ? { ok: true } : updated;
}

/** 直接改这个格子的数量和备注。数量为 0 就删掉这一行。 */
export async function setPlacementRecord(input: {
  materialId: string;
  locationCode: string;
  quantity: number;
  notes?: string;
}): Promise<{ ok: true } | LocationFailure> {
  const existing = await fetchPlacement(input.materialId, input.locationCode);
  if (!existing.ok) return existing;
  if (!(input.quantity > 0)) {
    if (!existing.placement) return { ok: true };
    return deletePlacement(existing.placement.id);
  }
  const notes = input.notes === undefined ? (existing.placement?.notes ?? "") : input.notes;
  const note = normalizePlacementNote(notes);
  if (!note.ok) return note;
  if (!existing.placement) {
    const inserted = await insertPlacementRow({
      materialId: input.materialId,
      locationCode: input.locationCode,
      quantity: input.quantity,
      notes: note.notes,
    });
    return inserted.ok ? { ok: true } : inserted;
  }
  const updated = await updatePlacementRow(existing.placement.id, input.quantity, note.notes);
  return updated.ok ? { ok: true } : updated;
}

/** 出库减少、入库和退库增加。减到 0 就删行。 */
export async function adjustPlacement(input: {
  materialId: string;
  locationCode: string;
  delta: number;
}): Promise<{ ok: true } | LocationFailure> {
  const existing = await fetchPlacement(input.materialId, input.locationCode);
  if (!existing.ok) return existing;
  const current = existing.placement?.quantity ?? 0;
  const next = fromCents(toCents(current) + toCents(input.delta));
  if (next < 0) {
    return { ok: false, error: `本位置只有 ${formatQty(current)}，不够这次扣减。` };
  }
  if (!existing.placement) {
    if (next === 0) return { ok: true };
    const inserted = await insertPlacementRow({
      materialId: input.materialId,
      locationCode: input.locationCode,
      quantity: next,
      notes: "",
    });
    return inserted.ok ? { ok: true } : inserted;
  }
  if (next === 0) return deletePlacement(existing.placement.id);
  const updated = await updatePlacementRow(existing.placement.id, next, existing.placement.notes);
  return updated.ok ? { ok: true } : updated;
}

/** 把数量挪到另一个货位。不写流水。 */
export async function transferPlacement(input: {
  materialId: string;
  fromCode: string;
  toCode: string;
  quantity: number;
}): Promise<{ ok: true } | LocationFailure> {
  if (input.fromCode === input.toCode) return { ok: false, error: "请换一个货位。" };
  if (!(input.quantity > 0)) return { ok: false, error: "移动数量必须大于 0。" };
  const source = await fetchPlacement(input.materialId, input.fromCode);
  if (!source.ok) return source;
  if (!source.placement || toCents(source.placement.quantity) < toCents(input.quantity)) {
    return { ok: false, error: `本位置只有 ${formatQty(source.placement?.quantity ?? 0)}。` };
  }
  const removed = await adjustPlacement({
    materialId: input.materialId,
    locationCode: input.fromCode,
    delta: -input.quantity,
  });
  if (!removed.ok) return removed;
  return placeMaterial({
    materialId: input.materialId,
    locationCode: input.toCode,
    quantity: input.quantity,
    notes: "",
  });
}

export async function ensureIssueFitsLocation(
  materialId: string,
  locationCode: string,
  quantity: number,
): Promise<{ ok: true } | LocationFailure> {
  const row = await fetchPlacement(materialId, locationCode);
  if (!row.ok) return row;
  if (!row.placement) return { ok: false, error: "这个货位没有这个物料。" };
  if (toCents(row.placement.quantity) < toCents(quantity)) {
    return { ok: false, error: `本位置只有 ${formatQty(row.placement.quantity)}，不能出这么多。` };
  }
  return { ok: true };
}
