const fs = require('fs')
let idx = fs.readFileSync('server/index.js', 'utf8')
if (idx.includes('/v1/ltc/family/bindings')) {
  console.log('routes already present')
  process.exit(0)
}
const nf = `return notFound(res, '接口不存在')`
const pos = idx.indexOf(nf, idx.indexOf('async function routeLtc'))
if (pos < 0) {
  console.error('notFound not found')
  process.exit(1)
}
const block = `
  // ---- Phase D N03-N15 ----
  if (path === '/v1/ltc/family/bindings' && method === 'GET') return ok(res, listFamilyBindings(ctx))
  if (path === '/v1/ltc/family/binding-requests') {
    if (method === 'GET') return ok(res, listBindingRequests(ctx, q))
    if (method === 'POST') return ok(res, createBindingRequest(ctx, await body()))
  }
  {
    const br = /^\\/v1\\/ltc\\/family\\/binding-requests\\/([A-Za-z0-9_-]+)\\/actions$/.exec(path)
    if (method === 'POST' && br) return ok(res, bindingRequestAction(ctx, br[1], await body()))
  }
  {
    const ft = /^\\/v1\\/ltc\\/family\\/applications\\/([A-Za-z0-9_-]+)\\/timeline$/.exec(path)
    if (method === 'GET' && ft) return ok(res, listApplicationTimeline(ctx, ft[1]))
  }
  if (path === '/v1/ltc/appeals') {
    if (method === 'GET') return ok(res, listAppeals(ctx, q))
    if (method === 'POST') return ok(res, createAppeal(ctx, await body()))
  }
  {
    const ap = /^\\/v1\\/ltc\\/appeals\\/([A-Za-z0-9_-]+)$/.exec(path)
    if (method === 'GET' && ap) return ok(res, getAppeal(ctx, ap[1]))
    const apa = /^\\/v1\\/ltc\\/appeals\\/([A-Za-z0-9_-]+)\\/actions$/.exec(path)
    if (method === 'POST' && apa) return ok(res, appealAction(ctx, apa[1], await body()))
  }
  if (path === '/v1/ltc/device-labels' && method === 'GET') return ok(res, listDeviceLabels(ctx, q))
  if (path === '/v1/ltc/device-labels/stats' && method === 'GET') return ok(res, deviceLabelStats(ctx, q))
  {
    const dl = /^\\/v1\\/ltc\\/devices\\/([A-Za-z0-9_-]+)\\/labels$/.exec(path)
    if (method === 'PATCH' && dl) return ok(res, patchDeviceLabels(ctx, dl[1], await body()))
  }
  if (path === '/v1/ltc/device-bindings') {
    if (method === 'GET') return ok(res, listDeviceBindings(ctx, q))
    if (method === 'POST') return ok(res, createDeviceBinding(ctx, await body()))
  }
  {
    const db = /^\\/v1\\/ltc\\/device-bindings\\/([A-Za-z0-9_-]+)\\/actions$/.exec(path)
    if (method === 'POST' && db) return ok(res, deviceBindingAction(ctx, db[1], await body()))
  }

`
idx = idx.slice(0, pos) + block + idx.slice(pos)
fs.writeFileSync('server/index.js', idx)
console.log('routes inserted', idx.includes('/v1/ltc/family/bindings'))
