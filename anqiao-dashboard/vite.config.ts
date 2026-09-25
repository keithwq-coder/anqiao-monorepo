import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 项目配置（INTEGRATION-SPEC §5）：VITE_PROJECT=kaijian|suqian 选择配置包
// VITE_API_BASE：API 基路径，默认同源相对（生产 nginx /v1 反代 console:2831）
// VITE_MOCK=1：仅本地开发显式 mock；生产禁止（INTEGRATION-SPEC 硬性基线 5）
export default defineConfig(({ mode }) => {
  const project = process.env.VITE_PROJECT ?? 'kaijian'
  const base = process.env.VITE_BASE ?? (project === 'suqian' ? '/suqian-dash/' : '/dash/')
  return {
    base,
    plugins: [vue()],
    define: {
      __VITE_PROJECT__: JSON.stringify(project),
    },
    server: {
      proxy: {
        // 本地联调 console server（node server/index.js，127.0.0.1:8080）；ws:true 转发 /v1/ws 握手
        // 硬件云一律经 /v1/hardware/* 服务端代理（阶段四收回浏览器直连，INTEGRATION-SPEC §6-1）
        '/v1': { target: process.env.VITE_DEV_API ?? 'http://localhost:8080', changeOrigin: true, ws: true },
      },
    },
  }
})
