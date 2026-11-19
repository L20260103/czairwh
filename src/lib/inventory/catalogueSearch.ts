/** 目录搜索。规格、名称和 SKU 走同一套 PostgREST or()，尺寸里的 - . / x 互相认。 */

export const CATALOGUE_PAGE_SIZE = 50;

/**
 * 会拿来 ilike 的列。规格只搜值，不搜键名，和 specSearchText 一样。
 * 这些键是目录里真正写过型号、尺寸或说明的字段。
 */
const SEARCH_COLUMNS = [
  "sku",
  "name_zh",
  "name_en",
  "specs->>size",
  "specs->>description_as_printed",
  "specs->>description",
  "specs->>type",
  "specs->>face_size",
  "specs->>dimensions",
  "specs->>spigot_mm",
  "specs->>model",
  "specs->>accessory_model",
  "specs->>indoor_model",
  "specs->>outdoor_model",
  "specs->>controller_model",
  "specs->>code",
  "specs->>printed_code",
  "specs->>kit_code",
  "specs->>notes",
  "specs->>suits",
  "specs->>brand",
  "specs->>colour",
] as const;

const DIMENSION_HEAD = /^(\d+(?:[-./xX×–—]\d+)+)/;

export interface CatalogueSearchPlan {
  /** 每一段是一整个 or() 的内部，多段之间是 AND。 */
  groups: string[];
  /** 给 supplier_code 用的 ilike 模式，已带前后通配。 */
  codePatterns: string[];
}

function cleanToken(token: string): string {
  return token.replace(/[*,()%]/g, "").trim();
}

function dimensionParts(token: string): string[] | null {
  const match = DIMENSION_HEAD.exec(token);
  if (!match?.[1]) return null;
  const parts = match[1].split(/[-./xX×–—]+/).filter((part) => part.length > 0);
  if (parts.length < 2 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts;
}

/**
 * 250-200 要能对上 250.200.200、250/200 和 250 x 200。
 * `_` 是 LIKE 的单字符。两段尺寸用 1–3 个字符的间隔；更长的只保留紧凑间隔，避免 or() 过长。
 */
function gapPatterns(parts: string[]): string[] {
  const gaps = parts.length >= 4 ? [1] : parts.length === 3 ? [1, 3] : [1, 2, 3];
  const patterns: string[] = [];
  const walk = (index: number, acc: string) => {
    const part = parts[index];
    if (part === undefined) return;
    if (index === parts.length - 1) {
      patterns.push(`*${acc}${part}*`);
      return;
    }
    for (const gap of gaps) walk(index + 1, `${acc}${part}${"_".repeat(gap)}`);
  };
  walk(0, "");
  return patterns;
}

function patternsForToken(token: string): string[] {
  const parts = dimensionParts(token);
  if (!parts) return [`*${token}*`];
  return gapPatterns(parts);
}

function clausesForPatterns(patterns: string[]): string {
  const clauses: string[] = [];
  for (const pattern of patterns) {
    for (const column of SEARCH_COLUMNS) clauses.push(`${column}.ilike.${pattern}`);
  }
  return clauses.join(",");
}

/** 空白分成多词，词与词是 AND。空搜索返回空计划。 */
export function catalogueSearchPlan(raw: string): CatalogueSearchPlan {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map(cleanToken)
    .filter((token) => token.length > 0);
  const groups: string[] = [];
  const codePatterns: string[] = [];
  for (const token of tokens) {
    const patterns = patternsForToken(token);
    if (patterns.length === 0) continue;
    codePatterns.push(...patterns);
    groups.push(clausesForPatterns(patterns));
  }
  return { groups, codePatterns };
}
