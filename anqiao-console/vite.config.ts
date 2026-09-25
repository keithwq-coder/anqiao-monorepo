import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 部署在 anqiao.aibrain.wiki/saas/ 子路径下；本地默认也按 /saas/ 基路径（与看板 /dash/ 区分）。
  // 切换到独立根域名时改为 '/'。
  base: process.env.VITE_BASE ?? '/saas/',
  plugins: [vue()],
  server: {
    proxy: {
      // SaaS 后端（npm run server，127.0.0.1:8080）；ws:true 转发 /v1/ws WebSocket 握手
      '/v1': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'vendor-echarts'
          }
          if (id.includes('node_modules/vue')) {
            return 'vendor-vue'
          }
        },
      },
    },
  },
})