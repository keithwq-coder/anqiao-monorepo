import { createApp, type App as VueApp } from 'vue'
import App from './App.vue'
import './styles/global.css'

let current: VueApp | null = null
let rootKind: 'screen' | 'console' | null = null

// 入口分流：#/console 开头挂载 SaaS 管理端控制台（懒加载，样式独立于大屏），否则维持大屏。
// 仅在 大屏 <-> 控制台 之间切换时重挂载；控制台内部子路由（#/console/patients 等）不触发重挂载。
function mount() {
  const nextKind = location.hash.startsWith('#/console') ? 'console' : 'screen'
  if (nextKind === rootKind) return
  rootKind = nextKind

  // 大屏在 global.css 中锁死 html/body 滚动（overflow:hidden 100vh）；
  // 控制台挂载时打 console-mode 标记，由 console.css 覆盖恢复文档流滚动；卸载时移除。
  const isConsole = nextKind === 'console'
  document.documentElement.classList.toggle('console-mode', isConsole)
  document.body.classList.toggle('console-mode', isConsole)

  if (isConsole) {
    void import('./views/console/ConsoleApp.vue').then((m) => {
      if (rootKind !== 'console') return // 加载期间已切回大屏
      current?.unmount()
      current = createApp(m.default)
      current.mount('#app')
    })
    return
  }
  current?.unmount()
  current = createApp(App)
  current.mount('#app')
}

mount()
window.addEventListener('hashchange', mount)
