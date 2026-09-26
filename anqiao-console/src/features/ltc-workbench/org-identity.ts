// 机构身份由登录会话租户上下文驱动（PRD §2.3.4）。
// 客户类型以账号矩阵为唯一权威清单；工作台展示的机构名/统筹区标识一律取自 principal。
import { computed } from 'vue'
import { getSession, type SessionInfo } from '../../api/http'

/** 统筹区 → 城市名（当前两个演示池的固有属性；新客户统筹区由数据层接入后在此登记） */
export const POOL_CITY_LABEL: Record<string, string> = {
  suqian: '宿迁市',
  moumou: '某某市',
}

export function poolCityLabel(poolId?: string | null): string {
  return POOL_CITY_LABEL[poolId || ''] || ''
}

/** 统筹区短标签（案卷元信息用） */
export function poolScopeLabel(poolId?: string | null): string {
  if (poolId === 'suqian') return '宿迁试点'
  if (poolId === 'moumou') return '某某市'
  return '统筹区'
}

export function useOrgIdentity() {
  const session: SessionInfo | null = getSession()
  const orgName = computed(() => session?.principal?.org_name || '机构')
  const orgId = computed(() => session?.principal?.org_id || null)
  const poolId = computed(() => session?.principal?.pool_id || null)
  return { orgName, orgId, poolId, session }
}
