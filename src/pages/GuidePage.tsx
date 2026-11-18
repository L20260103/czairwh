import { DUPLICATE_WINDOW_MS } from "@/lib/inventory/inventory";
import { STORAGE_KEY } from "@/lib/inventory/storage";

/** 当前试用所依据的业务假设。 */
const ASSUMPTIONS = [
  {
    title: "规则还没访谈，全部可改",
    detail:
      "数量精度、退库上限、最低库存和重复提交窗口都是试用假设，不是 Coolzone 的正式制度。改规则只需要改校验函数和说明，不会碰到 Tradify 或 monday。",
  },
  {
    title: "库存只由流水得出",
    detail: "现存数量是入库、退库减去出库。物料目录不能直接改数量。最低库存只决定要不要出现在待补货列表。",
  },
  {
    title: "整数和两位小数",
    detail:
      "个、套、台、卷、瓶、箱只接受正整数。米、千克、升、平方米最多两位小数。内部按 1 = 100 的整数计算，避免 0.1 + 0.2 这种误差。单笔最大 99999.99。最低库存为 0 表示不监控，这时允许填 0。",
  },
  {
    title: "入库",
    detail: "入库增加库存。工单不是必填。参考单号可选，用来记送货单或供应商文字，没有供应商主档，也不会生成采购单。",
  },
  {
    title: "出库",
    detail: "出库必须手填工单号和领用人。数量必须大于 0，且不能超过当前库存。",
  },
  {
    title: "退库上限",
    detail:
      "退库必须手填工单号，库存增加。同一物料在同一工单上，累计退库不能超过累计出库。没有该工单的出库记录就不能退。工单号忽略大小写和首尾空格。这是假设，访谈后可以放宽。",
  },
  {
    title: "流水只追加",
    detail: "记账后不能改、不能删。记错了再记一笔入库、出库或退库来调整。",
  },
  {
    title: "防止连点重复",
    detail:
      "30 秒内类型、物料、数量、操作人、工单、领用人、参考单号和备注完全相同的一笔会被拒绝。改一个备注，或等半分钟，就可以再记。",
  },
  {
    title: "待补货只是建议",
    detail:
      "当前库存低于最低库存时，建议补货量 = 最低库存 − 当前库存，只补到最低线。没有最高库存，也没有采购批量。建议不会发送给供应商，也不会写入 Tradify 或 monday。",
  },
  {
    title: "没有登录",
    detail: "操作人是手填或点选的记账字段，会记住上一次。这不是账号，也不能证明是谁操作的。",
  },
  {
    title: "目录修改限制",
    detail:
      "已有流水的物料不能删除，也不能改 SKU 或单位，否则历史数量会失去含义。名称、类别、库位、最低库存可以改。停用后不能再记账，历史仍保留。",
  },
  {
    title: "时间按墨尔本显示",
    detail: "时间以 ISO 字符串存储，界面和 CSV 按澳大利亚墨尔本时区显示。",
  },
  {
    title: "只存在这台浏览器里",
    detail:
      "数据写在 localStorage，键名 coolzone.hvac.prototype.v1。不是多人共享，没有服务器，也没有生产备份。换浏览器、无痕窗口或清除站点数据后，记录会消失。",
  },
  {
    title: "种子全是虚构的",
    detail:
      "初始物料、数量、员工、工单和供应商都是虚构的，界面和 CSV 标为示例数据。不要导入真实客户、员工、库存或工单。",
  },
];

const OUT_OF_SCOPE = [
  "财务、成本、售价和对账",
  "采购单、供应商下单和到货同步",
  "条码枪后台和扫码设备接入",
  "账号、角色、审批",
  "多人同时改同一本账",
  "把库存写回 Tradify 或 monday",
];

const LATER = [
  "访谈后再改退库、小数和最低库存算法",
  "若以后要对接，只先只读查询 Tradify 工单号，不自动扣库",
  "monday 项目链接，仍然不回写",
  "把待补货 CSV 交给人去下单，而不是在这个原型里发送",
  "条码只作为更快输入 SKU 的方式",
  "真要给仓库多人用，再单独做账号和服务器备份",
];

/** 假设与范围（#/guide）。 */
export function GuidePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#1c3144]">假设与范围</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        这是 Coolzone Heating & Cooling 的内部库存试用，不是上线系统。业务规则还没有访谈，下面每一条都可以改。完全相同的记账会在 {DUPLICATE_WINDOW_MS / 1000} 秒内被拒绝。
      </p>

      <section className="mt-6">
        <h2 className="font-semibold text-[#1c3144]">现在按这些假设在跑</h2>
        <ol className="mt-3 grid gap-3">
          {ASSUMPTIONS.map((item, index) => (
            <li key={item.title} className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
              <p className="text-sm font-semibold text-[#1c3144]">
                {index + 1}. {item.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">浏览器存储键名：{STORAGE_KEY}</p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
          <h2 className="font-semibold text-[#1c3144]">这版明确不做</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
            {OUT_OF_SCOPE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
          <h2 className="font-semibold text-[#1c3144]">以后可以再谈</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
            {LATER.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-[#8a4b16]">这些只是文字，页面上没有对应的操作按钮。</p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-[#ead9c4] bg-[#fbf6ee] p-4 text-sm leading-6 text-[#6b4423]">
        <h2 className="font-semibold">怎么试</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>在库存里搜索「铜管」或打开「只看低于最低」。</li>
          <li>给 15mm 铜管记一笔入库，看库存和流水一起变。</li>
          <li>用示例工单做出库，再试一次超过库存的数量，应该被拒绝。</li>
          <li>对同一工单退库，退到超过领用数量时应该被拒绝。</li>
          <li>连着提交完全相同的一笔，第二笔会被拦住。</li>
          <li>导出 CSV，刷新页面，确认刚才的流水还在。然后可以用「恢复示例」清掉。</li>
        </ol>
      </section>
    </div>
  );
}
