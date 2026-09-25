import { createApp } from 'vue'
import App from './App.vue'
import './styles/global.css'

// 大屏纯前端入口（INTEGRATION-SPEC §3：大屏不自带后端/控制台）。
// 控制台已迁至 anqiao-console 仓独立部署（/saas/），本仓不再挂载 console 路由。
createApp(App).mount('#app')
