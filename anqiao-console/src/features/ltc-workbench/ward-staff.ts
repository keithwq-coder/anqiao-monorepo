import { ref, computed } from 'vue'

export interface CaregiverSeat {
  id: string
  name: string
  roleTitle: string
  avatar: string
  floor: string
  onDuty: boolean
  bedRange: string
  patientCount: number
  pendingTurns: number
  username?: string
}

// 体验域角色群账号与花名册于系统验收后统一制作（PRD §2.3.3），当前为诚实空态
const allStaffList = ref<CaregiverSeat[]>([])

// 当前选中的特定作业护工（点击名字秒切个人工作台）
const activeCaregiver = ref<CaregiverSeat | null>(null)

// 当前正在查看的病区楼层（默认 4F）
const activeRosterFloor = ref<string>('4F')

// 自动切回公共大盘倒计时
const autoReturnCountdown = ref(30)
let autoReturnInterval: any = null

export function useWardStaff() {
  const currentWardCaregivers = computed(() => {
    return allStaffList.value.filter((c) => c.floor === activeRosterFloor.value)
  })

  const onDutyCaregivers = computed(() => {
    return currentWardCaregivers.value.filter((c) => c.onDuty)
  })

  function selectCaregiver(cg: CaregiverSeat) {
    activeCaregiver.value = cg
    resetAutoReturnTimer()
    startAutoReturnCountdown()
  }

  function clearActiveCaregiver() {
    activeCaregiver.value = null
    if (autoReturnInterval) {
      clearInterval(autoReturnInterval)
      autoReturnInterval = null
    }
  }

  function resetAutoReturnTimer() {
    autoReturnCountdown.value = 30
  }

  function startAutoReturnCountdown() {
    if (autoReturnInterval) clearInterval(autoReturnInterval)
    autoReturnCountdown.value = 30
    autoReturnInterval = setInterval(() => {
      if (autoReturnCountdown.value > 1) {
        autoReturnCountdown.value--
      } else {
        clearActiveCaregiver()
      }
    }, 1000)
  }

  function toggleDuty(staffId: string, onDuty: boolean) {
    const item = allStaffList.value.find((c) => c.id === staffId)
    if (item) {
      item.onDuty = onDuty
      if (!onDuty && activeCaregiver.value?.id === staffId) {
        clearActiveCaregiver()
      }
    }
  }

  function setRosterFloor(floor: string) {
    activeRosterFloor.value = floor
    clearActiveCaregiver()
  }

  return {
    allStaffList,
    activeCaregiver,
    activeRosterFloor,
    autoReturnCountdown,
    currentWardCaregivers,
    onDutyCaregivers,
    selectCaregiver,
    clearActiveCaregiver,
    resetAutoReturnTimer,
    toggleDuty,
    setRosterFloor,
  }
}
