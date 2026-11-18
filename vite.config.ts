import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// 打包成一个自带 JS/CSS 的 index.html，可以直接双击离线打开（file://）。
// GitHub Pages 项目站点在 /czairwh/。单文件产物不引用外部资源，设置 base 不改变打包字节。
export default defineConfig({
  base: "/czairwh/",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
