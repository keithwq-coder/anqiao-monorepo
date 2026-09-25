// 中国示意地图资产构建脚本（可重复执行）
// 数据源：DataV GeoAtlas 100000_full.json（含 100000_JD 十段线/南海诸岛 feature）
// 用法：node scripts/build-china-map.mjs [输入GeoJSON路径]（默认 tmp_china.json）
// 输出：src/assets/chinaMap.ts
// 投影：经度线性、纬度乘 cos(35°) 修正纵横比（示意地图，不追求精确投影）。

import { readFileSync, writeFileSync } from 'node:fs'

const INPUT = process.argv[2] ?? 'tmp_china.json'
const OUTPUT = 'src/assets/chinaMap.ts'
const POINT_BUDGET = 2900 // 抽稀后全国轮廓总点数上限（南海诸岛不占预算）

const geo = JSON.parse(readFileSync(INPUT, 'utf8'))

// ---------- 投影 ----------
const COS35 = Math.cos((35 * Math.PI) / 180)
const project = ([lon, lat]) => [lon, -lat * COS35] // y 取负，SVG 向下为正

// ---------- Douglas-Peucker 简化 ----------
function perpendicularDist(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  const tc = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + tc * dx), p[1] - (a[1] + tc * dy))
}

function douglasPeucker(points, eps) {
  if (points.length <= 3) return points
  let maxDist = 0
  let maxIdx = 0
  const first = points[0]
  const last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }
  if (maxDist <= eps) return [first, last]
  const left = douglasPeucker(points.slice(0, maxIdx + 1), eps)
  const right = douglasPeucker(points.slice(maxIdx), eps)
  return [...left.slice(0, -1), ...right]
}

// ---------- 提取省环 ----------
function ringsOf(feature) {
  const g = feature.geometry
  if (!g) return []
  // 仅保留外环（每个 polygon 的第一个 ring）
  if (g.type === 'MultiPolygon') return g.coordinates.map((poly) => poly[0])
  if (g.type === 'Polygon') return [g.coordinates[0]]
  return []
}

const provinces = [] // { adcode, name, rings }
let southSea = null // 十段线/南海诸岛：不抽稀，右下角小插图渲染（合规底线，不可丢）

for (const f of geo.features) {
  const { adcode, name } = f.properties
  const rings = ringsOf(f)
  if (rings.length === 0) continue
  if (String(adcode).endsWith('_JD')) {
    southSea = { rings }
    continue
  }
  provinces.push({ adcode, name, rings })
}
if (!southSea) throw new Error('未找到南海诸岛（100000_JD）feature，数据源不完整，终止')

// ---------- 抽稀：全国总点数 < 预算 ----------
function totalPoints(eps) {
  let n = 0
  for (const p of provinces) {
    for (const ring of p.rings) {
      n += douglasPeucker(ring.map(project), eps).length
    }
  }
  return n
}

let eps = 0.01
while (totalPoints(eps) > POINT_BUDGET && eps < 5) eps *= 1.5
const finalCount = totalPoints(eps)
console.log(`抽稀参数 eps=${eps.toFixed(4)}，全国轮廓点数 ${finalCount}（预算 ${POINT_BUDGET}）`)

// ---------- 生成 SVG path ----------
const PREC = 1 // 投影后坐标精度
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

// 投影空间内简化 + 生成 path（与抽稀统计同一口径）；trackBox=false 时不计入主视图 bbox（南海插图）
function simplifiedRingToPath(ring, simplifyEps, trackBox = true) {
  const pts = simplifyEps > 0 ? douglasPeucker(ring.map(project), simplifyEps) : ring.map(project)
  let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity
  const d =
    pts
      .map(([x, y], i) => {
        sMinX = Math.min(sMinX, x); sMaxX = Math.max(sMaxX, x)
        sMinY = Math.min(sMinY, y); sMaxY = Math.max(sMaxY, y)
        if (trackBox) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x)
          minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        }
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(PREC)},${y.toFixed(PREC)}`
      })
      .join('') + 'Z'
  return { d, box: [sMinX, sMinY, sMaxX - sMinX, sMaxY - sMinY] }
}

const provincePaths = provinces.map((p) => ({
  adcode: p.adcode,
  name: p.name,
  d: p.rings.map((r) => simplifiedRingToPath(r, eps).d).join(''),
}))

// 南海诸岛：不抽稀，完整保留，独立 bbox 供右下角插图定位
const southSeaParts = southSea.rings.map((r) => simplifiedRingToPath(r, 0, false))
const southSeaD = southSeaParts.map((p) => p.d).join('')
const ssMinX = Math.min(...southSeaParts.map((p) => p.box[0]))
const ssMinY = Math.min(...southSeaParts.map((p) => p.box[1]))
const ssMaxX = Math.max(...southSeaParts.map((p) => p.box[0] + p.box[2]))
const ssMaxY = Math.max(...southSeaParts.map((p) => p.box[1] + p.box[3]))
const southSeaBox = [ssMinX, ssMinY, ssMaxX - ssMinX, ssMaxY - ssMinY]

// ---------- 城市坐标（与地图同一套投影） ----------
const CITY_LONLAT = {
  苏州: [120.58, 31.30],
  上海: [121.47, 31.23],
  杭州: [120.16, 30.29],
  宿迁: [118.28, 33.96],
  西安: [108.94, 34.34],
  北京: [116.41, 39.90],
}

const out = `// 本文件由 scripts/build-china-map.mjs 自动生成，勿手改
// 数据源：DataV GeoAtlas areas_v3/bound/100000_full.json
// 投影：经度线性、纬度乘 cos(35°)（示意图）；城市坐标与省份轮廓共用同一投影，保证落点压图
export interface ProvincePath { adcode: number | string; name: string; d: string }

export const MAP_COS35 = ${COS35}

export function projectLonLat(lon: number, lat: number): [number, number] {
  return [lon, -lat * MAP_COS35]
}

export const MAP_VIEW_BOX = '${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}'

export const PROVINCES: ProvincePath[] = ${JSON.stringify(provincePaths)}

// 南海诸岛（十段线）：右下角小插图渲染，不可删；SOUTH_SEA_BOX 为其独立 bbox
export const SOUTH_SEA_D = ${JSON.stringify(southSeaD)}
export const SOUTH_SEA_BOX = [${southSeaBox.map((n) => n.toFixed(1)).join(', ')}] as const

export const CITY_LONLAT: Record<string, [number, number]> = ${JSON.stringify(CITY_LONLAT)}
`

writeFileSync(OUTPUT, out)
console.log(`已生成 ${OUTPUT}（${provinces.length} 省 + 南海诸岛插图，${(out.length / 1024).toFixed(1)}KB）`)
