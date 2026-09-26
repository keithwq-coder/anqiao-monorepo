import { ref, computed } from 'vue'
import {
  GRID_AREAS,
  GRID_CAREGIVERS,
  HOME_ELDERS,
  HOME_WORK_ORDERS,
  type GridCaregiver,
  type HomeElderly,
  type HomeWorkOrder,
} from './home-care-data'

// 全局单例响应式状态
const selectedAreaKey = ref<'all' | 'canglang' | 'shuangta' | 'sanxiang'>('all')
const activeCaregiverId = ref<string | null>(null)
const selectedStaffCategory = ref<'all' | 'caregiver' | 'idt_medical' | 'qa_manager'>('all')
const selectedStateFilter = ref<string>('all') // 'all' | '在家长者' | '异常预警' | '独居' | '重度失能'
const searchQuery = ref<string>('')
const activeElderlyId = ref<string | null>(null)

// 响应式长者列表与工单列表
const elders = ref<HomeElderly[]>([...HOME_ELDERS])
const workOrders = ref<HomeWorkOrder[]>([...HOME_WORK_ORDERS])
const caregivers = ref<GridCaregiver[]>([...GRID_CAREGIVERS])

// 当前选中的责任助老员对象
const activeCaregiver = computed(() => {
  if (!activeCaregiverId.value) return null
  return caregivers.value.find((c) => c.id === activeCaregiverId.value) || null
})

// 当前选中的片区配置
const currentAreaConfig = computed(() => {
  if (selectedAreaKey.value === 'all') return null
  return GRID_AREAS[selectedAreaKey.value] || null
})

// 过滤后的长者列表（严格按规范：全量加载 72 位长者，杜绝分页截断导致的跨片区筛选丢失）
const filteredElders = computed(() => {
  return elders.value.filter((elder) => {
    // 1. 如果选中了特定人员
    if (activeCaregiver.value) {
      // 若助老员今日轮休，则直接返回空长者列表（交由空状态卡片呈现）
      if (!activeCaregiver.value.onDuty) {
        return false
      }
      // 如果是片区助老员，精准匹配 elder.assigned_caregiver_id
      if (activeCaregiver.value.category === 'caregiver') {
        if (elder.assigned_caregiver_id !== activeCaregiver.value.id) {
          return false
        }
      } else if (activeCaregiver.value.id === 'demo_nurse_shen') {
        // 专职护师：重点关注重度失能、慢性创面与管路护理长者
        if (elder.ltc_level !== '重度失能') return false
      } else if (activeCaregiver.value.id === 'pt_chenjianxin') {
        // 康复治疗师：中度/重度失能伴有偏瘫或骨折恢复长者
        const isTarget = elder.chronic_diseases.some((c: string) => c.includes('卒中') || c.includes('骨折') || c.includes('肢体')) || elder.ltc_level === '重度失能'
        if (!isTarget) return false
      } else if (activeCaregiver.value.id === 'dementia_zhufang') {
        // 认知症专护：阿尔茨海默病或认知障碍长者
        const isDementia = elder.chronic_diseases.some((c: string) => c.includes('认知') || c.includes('阿尔茨海默'))
        if (!isDementia) return false
      } else if (activeCaregiver.value.id === 'tech_zhanghongbo') {
        // 适老工程顾问：无电梯高楼层或重度失能需辅具适配长者
        if (elder.has_elevator && elder.ltc_level !== '重度失能') return false
      }
    } else if (selectedAreaKey.value !== 'all') {
      // 2. 否则按片区筛选
      if (elder.area_key !== selectedAreaKey.value) {
        return false
      }
    }

    // 3. 状态筛选
    if (selectedStateFilter.value === '在家长者' && elder.current_state !== '在家长者') {
      return false
    }
    if (selectedStateFilter.value === '异常预警' && elder.current_state !== '异常预警') {
      return false
    }
    if (selectedStateFilter.value === '独居' && elder.living_status !== '独居') {
      return false
    }
    if (selectedStateFilter.value === '重度失能' && elder.ltc_level !== '重度失能') {
      return false
    }

    // 4. 模糊搜索（姓名/门牌/电话/身份证）
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      const matchName = elder.name.toLowerCase().includes(q)
      const matchAddr = elder.home_address.toLowerCase().includes(q)
      const matchPhone = elder.phone.includes(q)
      const matchId = elder.id_card.includes(q)
      const matchCg = elder.assigned_caregiver_name.includes(q)
      if (!matchName && !matchAddr && !matchPhone && !matchId && !matchCg) {
        return false
      }
    }

    return true
  })
})

// 当前活跃的长者详情记录
const activeElderlyDetail = computed(() => {
  if (!activeElderlyId.value) return null
  return elders.value.find((e) => e.elderly_id === activeElderlyId.value) || null
})

// 助老员专属待办工单
const activeCaregiverWorkOrders = computed(() => {
  if (!activeCaregiver.value) return workOrders.value
  return workOrders.value.filter((wo) => wo.caregiver_id === activeCaregiver.value!.id)
})

// 异常预警统计
const alertElderlyCount = computed(() => {
  return elders.value.filter((e) => e.current_state === '异常预警').length
})

// 独居长者统计
const livingAloneCount = computed(() => {
  return elders.value.filter((e) => e.living_status === '独居').length
})

// 重度失能统计
const severeDisabilityCount = computed(() => {
  return elders.value.filter((e) => e.ltc_level === '重度失能').length
})

// 快速动作
function setArea(areaKey: 'all' | 'canglang' | 'shuangta' | 'sanxiang') {
  selectedAreaKey.value = areaKey
  // 如果当前选中的助老员不属于该片区，则清空助老员选择
  if (activeCaregiver.value && areaKey !== 'all' && activeCaregiver.value.areaKey !== areaKey) {
    activeCaregiverId.value = null
  }
}

function selectCaregiver(cg: GridCaregiver) {
  activeCaregiverId.value = cg.id
  selectedAreaKey.value = cg.areaKey
}

function clearCaregiverSelection() {
  activeCaregiverId.value = null
}

// 轮休人员卡片提供的“一键查看本片区全体长者”
function viewAllAreaElders(areaKey: 'all' | 'canglang' | 'shuangta' | 'sanxiang') {
  activeCaregiverId.value = null
  selectedAreaKey.value = areaKey
  selectedStateFilter.value = 'all'
  searchQuery.value = ''
}

function setStaffCategory(cat: 'all' | 'caregiver' | 'idt_medical' | 'qa_manager') {
  selectedStaffCategory.value = cat
}

function openElderlyDetail(elderlyId: string) {
  activeElderlyId.value = elderlyId
}

function closeElderlyDetail() {
  activeElderlyId.value = null
}

// 工单执行与存证弹窗状态
const activeWorkOrderId = ref<string | null>(null)
const activeWorkOrder = computed(() => {
  return workOrders.value.find((w) => w.order_id === activeWorkOrderId.value) || null
})

function openWorkOrderDetail(orderId: string) {
  activeWorkOrderId.value = orderId
}

function closeWorkOrderDetail() {
  activeWorkOrderId.value = null
}

// 突发急救与跌倒调度弹窗
const isEmergencyModalOpen = ref(false)

function openEmergencyModal() {
  isEmergencyModalOpen.value = true
}

function closeEmergencyModal() {
  isEmergencyModalOpen.value = false
}

// 工单状态流转（接单 -> 出发 -> 入户打卡 -> 完工存证 -> 长护险核销）
function updateWorkOrderStatus(
  orderId: string,
  newStatus: 'pending_dispatch' | 'accepted' | 'en_route' | 'serving' | 'completed' | 'verified' | 'urgent_alert',
  extraData?: Partial<import('./home-care-data').HomeWorkOrder>,
) {
  const wo = workOrders.value.find((w) => w.order_id === orderId)
  if (!wo) return

  wo.status = newStatus
  if (extraData) {
    Object.assign(wo, extraData)
  }

  // 若工单转为服务完成或长护险已核销，同步增加该长者本月已完成服务次数
  if (newStatus === 'verified' || newStatus === 'completed') {
    const elder = elders.value.find((e) => e.elderly_id === wo.elderly_id)
    if (elder && elder.monthly_service_completed < elder.monthly_service_quota) {
      elder.monthly_service_completed += 1
      elder.last_service_time = `今日 ${new Date().toTimeString().slice(0, 5)}`
    }
  }
}

// 新增入户工单
function addWorkOrder(order: import('./home-care-data').HomeWorkOrder) {
  workOrders.value.unshift(order)
}

export function useHomeCareStore() {
  return {
    selectedAreaKey,
    activeCaregiverId,
    selectedStaffCategory,
    selectedStateFilter,
    searchQuery,
    activeElderlyId,
    elders,
    workOrders,
    caregivers,
    activeCaregiver,
    currentAreaConfig,
    filteredElders,
    activeElderlyDetail,
    activeCaregiverWorkOrders,
    alertElderlyCount,
    livingAloneCount,
    severeDisabilityCount,
    activeWorkOrderId,
    activeWorkOrder,
    isEmergencyModalOpen,
    setArea,
    setStaffCategory,
    selectCaregiver,
    clearCaregiverSelection,
    viewAllAreaElders,
    openElderlyDetail,
    closeElderlyDetail,
    openWorkOrderDetail,
    closeWorkOrderDetail,
    openEmergencyModal,
    closeEmergencyModal,
    updateWorkOrderStatus,
    addWorkOrder,
  }
}
