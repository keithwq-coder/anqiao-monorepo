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
      '/v1': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
      // 安樵 AI健康守护仪 官方硬件 API 反向代理
      '/hardware-api': {
        target: 'https://api.health-track.anqiaokj.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/hardware-api/, ''),
        secure: false,
      },
    },
  },
})
