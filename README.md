# czairwh — Coolzone 库存试用（coolzone-inventory）

Coolzone Heating & Cooling 仓库的库存试用原型：物料目录、入库 / 出库 / 退库记账、流水、待补货建议、CSV 导出。
数据只保存在当前浏览器的 localStorage（键名 `coolzone.hvac.prototype.v1`），初始内容是虚构的示例数据，没有连接 Tradify / monday。

本项目是从原来的单文件成品 `reference/original.html` 还原出来的源码，界面和行为与原文件一致。

## 技术栈

React 19 + TypeScript、Vite、Tailwind CSS v4、shadcn/ui（Base UI 版）、lucide-react 图标、sonner 提示。

## 使用

```bash
npm install      # 安装依赖（需要 Node.js 20+）
npm run dev      # 本地开发，浏览器打开终端里显示的地址
npm run build    # 打包，生成 dist/index.html（一个文件，可直接双击离线打开）
npm run preview  # 预览打包结果
```

## 目录结构

```
index.html                 页面骨架（含顶部“怎么打开这个文件”提示条）
vite.config.ts             Vite 配置（单文件打包 vite-plugin-singlefile，@ 指向 src）
src/
  main.tsx                 入口
  App.tsx                  按 hash 路由选择页面
  index.css                Tailwind 引入、主题颜色、字体
  lib/
    router.tsx             极简 hash 路由（#/inventory 这类地址）
    utils.ts               cn() 合并 class
    format.ts              时间（墨尔本）和文字格式化
    csv.ts                 三种 CSV 导出
    inventory/
      units.ts             单位、类别 / 库位建议
      types.ts             数据类型
      inventory.ts         库存计算和全部校验规则
      sampleData.ts        示例物料和示例流水
      storage.ts           localStorage 读写和数据校验
  store/
    InventoryProvider.tsx  全局库存状态（React Context）
  components/
    AppShell.tsx           侧栏、顶栏、手机底部导航、恢复示例
    MovementForm.tsx       出入库表单 + 预览
    MovementList.tsx       流水表格 / 卡片
    MaterialDialog.tsx     新增 / 编辑物料弹窗
    OptionSelect.tsx       下拉选择
    common.tsx             页面标题、标记、表单字段等小组件
    ui/                    shadcn/ui 组件
  pages/                   各页面：总览、库存、出入库、流水、待补货、物料目录、假设与范围
reference/                 原始文件，仅供对照，不参与打包
  original.html            原始单文件（未改动）
  original.css             从原文件拆出的 CSS
  original.js              从原文件拆出的 JS（已格式化）
  original.decompiled.js   反编译成 JSX 的 JS，便于对照阅读
```

## 改规则

数量精度、出库 / 退库限制、重复提交窗口等业务规则都在 `src/lib/inventory/inventory.ts`；
页面上的说明文字在 `src/pages/GuidePage.tsx`。
