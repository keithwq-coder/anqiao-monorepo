// 安守护 SaaS 切片 · 轻量 JSON 文件持久化模块
// 确保在控制台或大屏进行的告警接单、处置闭环、设备调校等操作，在服务重启或页面刷新后依然完整持久化。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORE_PATH = path.join(__dirname, 'store.json')

export function saveState(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('[Store] 持久化写入失败:', err.message)
  }
}

export function loadState() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8')
      return JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[Store] 未检测到 store.json 或解析失败，将使用初始种子数据:', err.message)
  }
  return null
}
