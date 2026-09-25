const fs = require('fs')
const path = require('path')
const file = path.join(__dirname, '..', 'server', 'ltc.js')
let s = fs.readFileSync(file, 'utf8')

const helper = `function assertWorkbenchRead(ctx) {
  const caps = ['application:read', 'task:read', 'assessed_person:read', 'supervision:read', '*']
  const ok = caps.some((c) => authorize(ctx, c).allow)
  if (!ok) throw new LtcError(403, '角色无权读取工作台摘要')
}

export function getWorkbenchSummary(ctx, query = {}) {
  assertWorkbenchRead(ctx)`

if (!s.includes('assertWorkbenchRead')) {
  s = s.replace(
    `export function getWorkbenchSummary(ctx, query = {}) {
  assertPerm(ctx, 'application:read')`,
    helper,
  )
  s = s.replace(
    `export function listWorkbenchTodos(ctx, query = {}) {
  assertPerm(ctx, 'application:read')`,
    `export function listWorkbenchTodos(ctx, query = {}) {
  assertWorkbenchRead(ctx)`,
  )
  fs.writeFileSync(file, s)
  console.log('patched ok')
} else {
  console.log('already patched')
}
