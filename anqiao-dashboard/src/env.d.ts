/// <reference types="vite/client" />

declare const __VITE_PROJECT__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_BASE?: string
  readonly VITE_PROJECT?: string
  /** 显式 mock 开关：仅 '1' 启用（本地开发）；生产禁止 */
  readonly VITE_MOCK?: string
  // 硬件云凭据禁止进入前端（INTEGRATION-SPEC §6-1 / API-CONTRACT §3.5）
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
