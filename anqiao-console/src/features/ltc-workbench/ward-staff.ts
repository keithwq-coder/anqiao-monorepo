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

// 全院病区责任护工与护士长花名册（支持护士长排班与轮休切换）
const allStaffList = ref<CaregiverSeat[]>([
  // 4F 完全失能专区
  {
    id: 'hn_4f',
    name: '沈雅琴',
    roleTitle: '4F护士长 (主管护师)',
    avatar: '👩‍⚕️',
    floor: '4F',
    onDuty: true,
    bedRange: '401-411全区',
    patientCount: 11,
    pendingTurns: 3,
    username: 'headnurse_4f',
  },
  {
    id: 'cg_4f_01',
    name: '李晓芳',
    roleTitle: '责任组长 (高级照护师)',
    avatar: '👩‍⚕️',
    floor: '4F',
    onDuty: true,
    bedRange: '401-406床',
    patientCount: 6,
    pendingTurns: 2,
    username: 'kaijian_nurse01',
  },
  {
    id: 'cg_4f_02',
    name: '王芳',
    roleTitle: '责任护工 (中级照护师)',
    avatar: '🧑‍⚕️',
    floor: '4F',
    onDuty: true,
    bedRange: '407-411床',
    patientCount: 5,
    pendingTurns: 1,
    username: 'kaijian_cg_4f_02',
  },
  {
    id: 'cg_4f_03',
    name: '刘建国',
    roleTitle: '当值护工 (初级照护师)',
    avatar: '👨‍⚕️',
    floor: '4F',
    onDuty: true,
    bedRange: '401-411机动',
    patientCount: 6,
    pendingTurns: 1,
    username: 'kaijian_cg_4f_03',
  },
  {
    id: 'cg_4f_04',
    name: '孙秀英',
    roleTitle: '轮班护工 (今日轮休)',
    avatar: '👩‍⚕️',
    floor: '4F',
    onDuty: false,
    bedRange: '今日轮休',
    patientCount: 0,
    pendingTurns: 0,
    username: 'kaijian_cg_4f_04',
  },

  // 3F 认知障碍专区
  {
    id: 'hn_3f',
    name: '林素梅',
    roleTitle: '3F护士长 (主管护师)',
    avatar: '👩‍⚕️',
    floor: '3F',
    onDuty: true,
    bedRange: '301-311全区',
    patientCount: 11,
    pendingTurns: 3,
    username: 'headnurse_3f',
  },
  {
    id: 'cg_3f_01',
    name: '张晓敏',
    roleTitle: '责任组长 (认知症专护)',
    avatar: '👩‍⚕️',
    floor: '3F',
    onDuty: true,
    bedRange: '301-306床',
    patientCount: 6,
    pendingTurns: 1,
    username: 'kaijian_nurse02',
  },
  {
    id: 'cg_3f_02',
    name: '陈宇',
    roleTitle: '责任护工 (中级照护师)',
    avatar: '👨‍⚕️',
    floor: '3F',
    onDuty: true,
    bedRange: '307-311床',
    patientCount: 5,
    pendingTurns: 2,
    username: 'kaijian_cg_3f_02',
  },
  {
    id: 'cg_3f_03',
    name: '周平',
    roleTitle: '轮班护工 (今日轮休)',
    avatar: '👨‍⚕️',
    floor: '3F',
    onDuty: false,
    bedRange: '今日轮休',
    patientCount: 0,
    pendingTurns: 0,
    username: 'kaijian_cg_3f_03',
  },

  // 2F 康复专区
  {
    id: 'hn_2f',
    name: '朱秀华',
    roleTitle: '2F护士长 (主管护师)',
    avatar: '👩‍⚕️',
    floor: '2F',
    onDuty: true,
    bedRange: '201-211全区',
    patientCount: 11,
    pendingTurns: 2,
    username: 'headnurse_2f',
  },
  {
    id: 'cg_2f_01',
    name: '赵燕',
    roleTitle: '责任组长 (康复介护师)',
    avatar: '👩‍⚕️',
    floor: '2F',
    onDuty: true,
    bedRange: '201-206床',
    patientCount: 6,
    pendingTurns: 1,
    username: 'kaijian_cg_2f_01',
  },
  {
    id: 'cg_2f_02',
    name: '吴强',
    roleTitle: '责任护工 (中级照护师)',
    avatar: '👨‍⚕️',
    floor: '2F',
    onDuty: true,
    bedRange: '207-211床',
    patientCount: 5,
    pendingTurns: 1,
    username: 'kaijian_cg_2f_02',
  },
  {
    id: 'cg_2f_03',
    name: '郑华',
    roleTitle: '轮班护工 (今日轮休)',
    avatar: '👩‍⚕️',
    floor: '2F',
    onDuty: false,
    bedRange: '今日轮休',
    patientCount: 0,
    pendingTurns: 0,
    username: 'kaijian_cg_2f_03',
  },

  // 1F 慢病颐养专区
  {
    id: 'hn_1f',
    name: '严冬梅',
    roleTitle: '1F护士长 (主管护师)',
    avatar: '👩‍⚕️',
    floor: '1F',
    onDuty: true,
    bedRange: '101-111全区',
    patientCount: 11,
    pendingTurns: 1,
    username: 'headnurse_1f',
  },
  {
    id: 'cg_1f_01',
    name: '何丽',
    roleTitle: '责任组长 (慢病照护师)',
    avatar: '👩‍⚕️',
    floor: '1F',
    onDuty: true,
    bedRange: '101-106床',
    patientCount: 6,
    pendingTurns: 0,
    username: 'kaijian_cg_1f_01',
  },
  {
    id: 'cg_1f_02',
    name: '宋敏',
    roleTitle: '责任护工 (中级照护师)',
    avatar: '🧑‍⚕️',
    floor: '1F',
    onDuty: true,
    bedRange: '107-111床',
    patientCount: 5,
    pendingTurns: 1,
    username: 'kaijian_cg_1f_02',
  },
  {
    id: 'cg_1f_03',
    name: '马桂英',
    roleTitle: '轮班护工 (今日轮休)',
    avatar: '👩‍⚕️',
    floor: '1F',
    onDuty: false,
    bedRange: '今日轮休',
    patientCount: 0,
    pendingTurns: 0,
    username: 'kaijian_cg_1f_03',
  },
])

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
