import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 宿迁长护险大屏部署在 anqiao.aibrain.wiki/suqian-dash/ 子路径下（/dash/ 为原中科安樵+凯健看板，勿占用）
  // SaaS 控制台生产构建用 VITE_BASE=/saas/（见 README 生产部署一节）
  base: process.env.VITE_BASE ?? '/suqian-dash/',
  plugins: [vue()],
  server: {
    proxy: {
      // SaaS 切片后端（npm run server，127.0.0.1:8080）；ws:true 转发 /v1/ws WebSocket 握手
      // 硬件云一律经 /v1/hardware/* 服务端代理；冻结仓禁止开发代理直连
      '/v1': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
    },
  },
})
