import { createApp } from 'vue'
import './styles/console.css'
import ConsoleApp from './views/console/ConsoleApp.vue'

// 本仓库即管理端 SaaS 控制台：无大屏 global.css 的滚动锁定与深色背景，直接进入控制台模式。
// console.css 通过 body.console-mode 选择器生效，故在此显式打标。
document.documentElement.classList.add('console-mode')
document.body.classList.add('console-mode')

createApp(ConsoleApp).mount('#app')