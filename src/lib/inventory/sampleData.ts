import { postMovement, createEmptyState } from "./inventory";
import type { InventoryState, Material, MovementType } from "./types";
import type { UnitCode } from "./units";

export const SAMPLE_CREATED_AT = "2026-11-01T08:00:00+11:00";
export const SAMPLE_NOTE = "示例数据。虚构物料，仅供试用。";
export const SAMPLE_OPERATORS = ["示例·仓库小张", "示例·林工", "示例·周师傅"];
export const SAMPLE_RECIPIENTS = ["示例·周师傅", "示例·林工", "示例·安装组甲"];
export const SAMPLE_JOBS = [
  "CZ-JOB-2401 示例·Southbank公寓",
  "CZ-JOB-2402 示例·Richmond办公室",
  "CZ-JOB-2403 示例·BoxHill诊所",
];
export const SAMPLE_SUPPLIERS = ["示例·南区铜管供应", "示例·港区制冷贸易", "示例·墨尔本风口仓"];
const SAMPLE_MATERIALS: SampleMaterial[] = [
  {
    sku: "CZ-CU-22",
    name: "22mm 铜管",
    category: "铜管 Copper",
    unit: "metre",
    location: "A-01 铜管架",
    minStock: 30,
  },
  {
    sku: "CZ-CU-15",
    name: "15mm 铜管",
    category: "铜管 Copper",
    unit: "metre",
    location: "A-01 铜管架",
    minStock: 40,
  },
  {
    sku: "CZ-INS-13",
    name: "13mm 橡塑保温管",
    category: "保温 Insulation",
    unit: "metre",
    location: "A-02 保温架",
    minStock: 50,
  },
  {
    sku: "CZ-RF-R32",
    name: "R32 制冷剂",
    category: "制冷剂 Refrigerant",
    unit: "kg",
    location: "B-01 冷媒柜",
    minStock: 20,
  },
  {
    sku: "CZ-RF-R410A",
    name: "R410A 制冷剂",
    category: "制冷剂 Refrigerant",
    unit: "kg",
    location: "B-01 冷媒柜",
    minStock: 15,
  },
  {
    sku: "CZ-GR-300",
    name: "300×300 双层百叶风口",
    category: "风口 Grille",
    unit: "piece",
    location: "C-03 风口架",
    minStock: 10,
  },
  {
    sku: "CZ-DF-150",
    name: "150mm 方形散流器",
    category: "风口 Grille",
    unit: "piece",
    location: "C-03 风口架",
    minStock: 8,
  },
  {
    sku: "CZ-FLT-G4",
    name: "G4 初效过滤网 595×595",
    category: "过滤 Filter",
    unit: "piece",
    location: "C-01 滤网架",
    minStock: 12,
  },
  {
    sku: "CZ-EL-2C",
    name: "2C 控制线",
    category: "电气 Electrical",
    unit: "metre",
    location: "D-02 线材",
    minStock: 100,
  },
  {
    sku: "CZ-FIT-22",
    name: "22mm 铜弯头",
    category: "配件 Fittings",
    unit: "piece",
    location: "A-03 配件盒",
    minStock: 25,
  },
  {
    sku: "CZ-TH-STAT",
    name: "壁挂温控器",
    category: "控制器 Controls",
    unit: "unit",
    location: "D-01 控制器柜",
    minStock: 5,
  },
  {
    sku: "CZ-DRN-20",
    name: "20mm 冷凝水管",
    category: "排水 Drainage",
    unit: "metre",
    location: "A-04 管材",
    minStock: 30,
  },
  {
    sku: "CZ-TAPE-AL",
    name: "铝箔胶带",
    category: "辅材 Consumable",
    unit: "roll",
    location: "E-01 辅材",
    minStock: 6,
  },
  {
    sku: "CZ-N2-CYL",
    name: "氮气瓶（试压）",
    category: "气体 Gas",
    unit: "bottle",
    location: "B-02 气体架",
    minStock: 4,
  },
];
function sampleTime(day: string, time: string): string {
  return `2026-11-${day}T${time}:00+11:00`;
}
const OPENING_NOTE = "示例数据 · 期初入库";
const REF_COPPER = "示例·南区铜管供应 DN-1101";
const REF_REFRIGERANT = "示例·港区制冷贸易 DN-2208";
const REF_GRILLE = "示例·墨尔本风口仓 DN-3310";
const SAMPLE_MOVEMENTS: SampleMovement[] = [
  {
    at: sampleTime("01", "09:00"),
    type: "receipt",
    sku: "CZ-CU-22",
    quantity: 80,
    operator: "示例·仓库小张",
    reference: REF_COPPER,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:05"),
    type: "receipt",
    sku: "CZ-CU-15",
    quantity: 50,
    operator: "示例·仓库小张",
    reference: REF_COPPER,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:10"),
    type: "receipt",
    sku: "CZ-INS-13",
    quantity: 60,
    operator: "示例·仓库小张",
    reference: REF_COPPER,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:15"),
    type: "receipt",
    sku: "CZ-FIT-22",
    quantity: 50,
    operator: "示例·仓库小张",
    reference: REF_COPPER,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:20"),
    type: "receipt",
    sku: "CZ-DRN-20",
    quantity: 60,
    operator: "示例·仓库小张",
    reference: REF_COPPER,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:30"),
    type: "receipt",
    sku: "CZ-RF-R32",
    quantity: 24,
    operator: "示例·仓库小张",
    reference: REF_REFRIGERANT,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:35"),
    type: "receipt",
    sku: "CZ-RF-R410A",
    quantity: 30,
    operator: "示例·仓库小张",
    reference: REF_REFRIGERANT,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:40"),
    type: "receipt",
    sku: "CZ-N2-CYL",
    quantity: 6,
    operator: "示例·仓库小张",
    reference: REF_REFRIGERANT,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:50"),
    type: "receipt",
    sku: "CZ-GR-300",
    quantity: 20,
    operator: "示例·仓库小张",
    reference: REF_GRILLE,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "09:55"),
    type: "receipt",
    sku: "CZ-DF-150",
    quantity: 10,
    operator: "示例·仓库小张",
    reference: REF_GRILLE,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "10:00"),
    type: "receipt",
    sku: "CZ-FLT-G4",
    quantity: 24,
    operator: "示例·仓库小张",
    reference: REF_GRILLE,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "10:05"),
    type: "receipt",
    sku: "CZ-TH-STAT",
    quantity: 8,
    operator: "示例·仓库小张",
    reference: REF_GRILLE,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "10:10"),
    type: "receipt",
    sku: "CZ-EL-2C",
    quantity: 120,
    operator: "示例·仓库小张",
    reference: REF_GRILLE,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("01", "10:15"),
    type: "receipt",
    sku: "CZ-TAPE-AL",
    quantity: 8,
    operator: "示例·仓库小张",
    reference: REF_GRILLE,
    notes: OPENING_NOTE,
  },
  {
    at: sampleTime("04", "10:20"),
    type: "issue",
    sku: "CZ-CU-22",
    quantity: 20,
    operator: "示例·林工",
    jobNumber: SAMPLE_JOBS[0],
    recipient: "示例·周师傅",
    notes: "示例数据 · 室内机配管",
  },
  {
    at: sampleTime("04", "10:30"),
    type: "issue",
    sku: "CZ-CU-15",
    quantity: 28,
    operator: "示例·林工",
    jobNumber: SAMPLE_JOBS[0],
    recipient: "示例·周师傅",
    notes: "示例数据 · 支管",
  },
  {
    at: sampleTime("04", "10:40"),
    type: "issue",
    sku: "CZ-INS-13",
    quantity: 24,
    operator: "示例·林工",
    jobNumber: SAMPLE_JOBS[0],
    recipient: "示例·周师傅",
    notes: "示例数据 · 保温",
  },
  {
    at: sampleTime("04", "11:00"),
    type: "issue",
    sku: "CZ-FIT-22",
    quantity: 10,
    operator: "示例·林工",
    jobNumber: SAMPLE_JOBS[0],
    recipient: "示例·周师傅",
    notes: "示例数据 · 弯头",
  },
  {
    at: sampleTime("04", "11:10"),
    type: "issue",
    sku: "CZ-DRN-20",
    quantity: 5,
    operator: "示例·林工",
    jobNumber: SAMPLE_JOBS[0],
    recipient: "示例·周师傅",
    notes: "示例数据 · 冷凝水",
  },
  {
    at: sampleTime("04", "15:00"),
    type: "issue",
    sku: "CZ-EL-2C",
    quantity: 35,
    operator: "示例·林工",
    jobNumber: SAMPLE_JOBS[0],
    recipient: "示例·周师傅",
    notes: "示例数据 · 温控线",
  },
  {
    at: sampleTime("05", "09:10"),
    type: "issue",
    sku: "CZ-CU-22",
    quantity: 14,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[1],
    recipient: "示例·安装组甲",
    notes: "示例数据 · 办公室改装",
  },
  {
    at: sampleTime("05", "09:20"),
    type: "issue",
    sku: "CZ-RF-R32",
    quantity: 6,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[1],
    recipient: "示例·安装组甲",
    notes: "示例数据 · 补充冷媒",
  },
  {
    at: sampleTime("05", "09:40"),
    type: "issue",
    sku: "CZ-GR-300",
    quantity: 4,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[1],
    recipient: "示例·安装组甲",
    notes: "示例数据 · 回风口",
  },
  {
    at: sampleTime("05", "09:50"),
    type: "issue",
    sku: "CZ-DF-150",
    quantity: 6,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[1],
    recipient: "示例·安装组甲",
    notes: "示例数据 · 散流器",
  },
  {
    at: sampleTime("05", "10:05"),
    type: "issue",
    sku: "CZ-TAPE-AL",
    quantity: 5,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[1],
    recipient: "示例·安装组甲",
    notes: "示例数据 · 包扎",
  },
  {
    at: sampleTime("06", "13:15"),
    type: "issue",
    sku: "CZ-RF-R410A",
    quantity: 4,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[2],
    recipient: "示例·林工",
    notes: "示例数据 · 新风机组",
  },
  {
    at: sampleTime("06", "13:25"),
    type: "issue",
    sku: "CZ-FLT-G4",
    quantity: 4,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[2],
    recipient: "示例·林工",
    notes: "示例数据 · 初效段",
  },
  {
    at: sampleTime("06", "13:40"),
    type: "issue",
    sku: "CZ-TH-STAT",
    quantity: 1,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[2],
    recipient: "示例·林工",
    notes: "示例数据 · 诊室温控",
  },
  {
    at: sampleTime("06", "16:05"),
    type: "return",
    sku: "CZ-CU-22",
    quantity: 2,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[0],
    notes: "示例数据 · 余料退库",
  },
  {
    at: sampleTime("06", "16:20"),
    type: "return",
    sku: "CZ-RF-R410A",
    quantity: 1,
    operator: "示例·仓库小张",
    jobNumber: SAMPLE_JOBS[2],
    notes: "示例数据 · 未用完退库",
  },
];

interface SampleMaterial {
  sku: string;
  name: string;
  category: string;
  unit: UnitCode;
  location: string;
  minStock: number;
}

interface SampleMovement {
  at: string;
  type: MovementType;
  sku: string;
  quantity: number;
  operator: string;
  jobNumber?: string;
  recipient?: string;
  reference?: string;
  notes: string;
}

function toSampleMaterial(item: SampleMaterial): Material {
  return {
    id: `mat-${item.sku.toLowerCase()}`,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: item.unit,
    location: item.location,
    minStock: item.minStock,
    active: true,
    note: SAMPLE_NOTE,
    sample: true,
    createdAt: SAMPLE_CREATED_AT,
  };
}

/** 生成示例库存：示例物料 + 期初入库 + 几笔出库/退库。 */
export function createSampleState(): InventoryState {
  const materials = SAMPLE_MATERIALS.map(toSampleMaterial);
  let state: InventoryState = { ...createEmptyState(), materials, lastOperator: "示例·仓库小张" };
  SAMPLE_MOVEMENTS.forEach((item, index) => {
    const material = state.materials.find((m) => m.sku === item.sku);
    if (!material) throw new Error(`示例物料缺失：${item.sku}`);
    const draft = {
      type: item.type,
      materialId: material.id,
      quantity: String(item.quantity),
      operator: item.operator,
      jobNumber: item.jobNumber ?? "",
      recipient: item.recipient ?? "",
      reference: item.reference ?? "",
      notes: item.notes,
    };
    const result = postMovement(state, draft, {
      id: `mv-${String(index + 1).padStart(2, "0")}`,
      at: item.at,
      sample: true,
    });
    if (!result.ok) {
      throw new Error(`示例流水无法记账 ${item.sku} ${item.type}: ${JSON.stringify(result.errors)}`);
    }
    state = result.state;
  });
  return state;
}
