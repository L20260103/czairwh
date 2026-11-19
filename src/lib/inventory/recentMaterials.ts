const STORAGE_KEY = "cz-catalogue-recent";
const MAX_RECENT = 12;

function readStored(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** 本机最近打开或记账过的物料，最新的在前。 */
export function readRecentMaterialIds(): string[] {
  return readStored();
}

/** 记一次，并返回新的列表。 */
export function rememberMaterialId(id: string): string[] {
  const next = [id, ...readStored().filter((item) => item !== id)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 隐私模式写不进时，这一次仍用内存里的顺序。
  }
  return next;
}
