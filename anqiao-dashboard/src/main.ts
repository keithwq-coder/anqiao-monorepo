import { createApp } from 'vue'
import App from './App.vue'
import './styles/global.css'
import { ensureScreenSession } from './api/http'

// 大屏启动静默鉴权（支持电视墙/一体机免登录无人值守）
void ensureScreenSession()

// 大屏纯前端入口（INTEGRATION-SPEC §3：大屏不自带后端/控制台）。
// 控制台已迁至 anqiao-console 仓独立部署（/saas/），本仓不再挂载 console 路由。
createApp(App).mount('#app')

