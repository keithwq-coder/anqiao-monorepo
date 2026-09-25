<script setup lang="ts">
import { computed } from 'vue'
import { useHomeCareStore } from '../home-care-store'
import type { GridCaregiver, HomeStaffCategory } from '../home-care-data'

const store = useHomeCareStore()

const props = defineProps<{
  isCollapsed?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-caregiver', cg: GridCaregiver): void
}>()

const categories: { key: HomeStaffCategory | 'all'; label: string; count: number }[] = [
  { key: 'caregiver', label: '片区助老', count: 8 },
  { key: 'idt_medical', label: '专业团队IDT', count: 4 },
  { key: 'qa_manager', label: '质控与管家', count: 3 },
]

const areas = [
  { key: 'all', label: '全区' },
  { key: 'canglang', label: '沧浪' },
  { key: 'shuangta', label: '双塔' },
  { key: 'sanxiang', label: '三香' },
] as const

const displayedStaff = computed(() => {
  let list = store.caregivers.value

  // 1. 团队类别过滤 (片区助老 / IDT 专业团队 / 质控与管家)
  if (store.selectedStaffCategory.value !== 'all') {
    list = list.filter((s) => s.category === store.selectedStaffCategory.value)
  }

  // 2. 如果当前在助老员类别且选了特定片区
  if (store.selectedStaffCategory.value === 'caregiver' && store.selectedAreaKey.value !== 'all') {
    list = list.filter((s) => s.areaKey === store.selectedAreaKey.value)
  }

  return list
})

function handleCategoryChange(cat: HomeStaffCategory | 'all') {
  store.setStaffCategory(cat)
  if (cat !== 'caregiver') {
    store.setArea('all')
  }
}

function handleCaregiverClick(cg: GridCaregiver) {
  store.selectCaregiver(cg)
  emit('select-caregiver', cg)
}
</script>

<template>
  <div class="caregiver-roster-submenu" :class="{ 'is-collapsed': isCollapsed }">
    <!-- 团队组织架构三维度切换 Pills (对标居家乐与福寿康全体系模型) -->
    <div v-if="!isCollapsed" class="category-tabs">
      <button
        v-for="c in categories"
        :key="c.key"
        :class="['cat-tab-btn', store.selectedStaffCategory.value === c.key && 'active']"
        @click="handleCategoryChange(c.key)"
        type="button"
      >
        {{ c.label }}
      </button>
    </div>

    <!-- 仅在“片区助老”分类下展示沧浪/双塔/三香快速切换 Pills -->
    <div v-if="!isCollapsed && store.selectedStaffCategory.value === 'caregiver'" class="area-pills">
      <button
        v-for="a in areas"
        :key="a.key"
        :class="['area-pill-btn', store.selectedAreaKey.value === a.key && 'active']"
        @click="store.setArea(a.key)"
        type="button"
      >
        {{ a.label }}
      </button>
    </div>

    <!-- 人员列表（带头像、连锁专业资质、分管人数，轮休置灰） -->
    <div class="caregiver-list">
      <button
        v-for="cg in displayedStaff"
        :key="cg.id"
        :class="[
          'caregiver-item',
          {
            active: store.activeCaregiverId.value === cg.id,
            'is-off-duty': !cg.onDuty,
            'is-idt': cg.category === 'idt_medical',
            'is-qa': cg.category === 'qa_manager',
          }
        ]"
        @click="handleCaregiverClick(cg)"
        :title="cg.onDuty ? `${cg.name} (${cg.roleTitle}) · 负责 ${cg.managedElderCount} 位长者` : `${cg.name} · 今日轮休`"
        type="button"
      >
        <span class="cg-tree-mark">└</span>
        <span class="cg-avatar">{{ cg.avatar }}</span>
        
        <div v-if="!isCollapsed" class="cg-meta">
          <div class="cg-name-row">
            <span class="cg-name">{{ cg.name }}</span>
            <span
              v-if="cg.onDuty"
              :class="[
                'cg-role-tag',
                cg.category === 'idt_medical' && 'tag-idt',
                cg.category === 'qa_manager' && 'tag-qa',
              ]"
            >
              {{ cg.categoryLabel }}
            </span>
            <span v-else class="cg-off-tag">今日轮休</span>
          </div>
          <div class="cg-sub-row">
            <span class="cg-area-badge">{{ cg.areaName }}</span>
            <span v-if="cg.onDuty" class="cg-stats-text">在管 {{ cg.managedElderCount }}人 · 待办 {{ cg.pendingWorkOrders }}</span>
            <span v-else class="cg-stats-off">今日排休中</span>
          </div>
        </div>

        <span
          v-if="store.activeCaregiverId.value === cg.id && !isCollapsed"
          class="active-indicator"
        ></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.caregiver-roster-submenu {
  margin: 4px 0 8px 12px;
  padding-left: 8px;
  border-left: 2px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-tabs {
  display: flex;
  gap: 2px;
  margin: 2px 0 4px 2px;
  background: rgba(0, 0, 0, 0.28);
  padding: 2px;
  border-radius: 6px;
}

.cat-tab-btn {
  flex: 1;
  padding: 4px 2px;
  font-size: 10px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.18s;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
}

.cat-tab-btn:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.08);
}

.cat-tab-btn.active {
  background: rgba(14, 165, 233, 0.35);
  color: #38bdf8;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.area-pills {
  display: flex;
  gap: 3px;
  margin: 2px 0 4px 2px;
  background: rgba(15, 23, 42, 0.35);
  padding: 2px;
  border-radius: 5px;
}

.area-pill-btn {
  flex: 1;
  padding: 2px 0;
  font-size: 10px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.18s;
  font-weight: 500;
}

.area-pill-btn:hover {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.05);
}

.area-pill-btn.active {
  background: #0284c7;
  color: #ffffff;
  font-weight: 600;
}

.caregiver-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.caregiver-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 6px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: #cbd5e1;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.caregiver-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.caregiver-item.active {
  background: rgba(14, 165, 233, 0.2);
  border-color: rgba(14, 165, 233, 0.5);
  color: #ffffff;
}

.caregiver-item.is-idt.active {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.5);
}

.caregiver-item.is-qa.active {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.5);
}

.cg-tree-mark {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.2);
  margin-right: -2px;
}

.cg-avatar {
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
}

.cg-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cg-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.cg-name {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.cg-role-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(14, 165, 233, 0.18);
  color: #38bdf8;
  font-weight: 500;
  white-space: nowrap;
}

.cg-role-tag.tag-idt {
  background: rgba(16, 185, 129, 0.18);
  color: #34d399;
}

.cg-role-tag.tag-qa {
  background: rgba(168, 85, 247, 0.18);
  color: #c084fc;
}

.cg-off-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
  font-weight: 500;
}

.cg-sub-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
}

.cg-area-badge {
  font-size: 9px;
  color: #94a3b8;
  max-width: 75px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cg-stats-text {
  color: #a7f3d0;
  font-size: 9px;
}

.cg-stats-off {
  color: #64748b;
  font-size: 9px;
}

.caregiver-item.is-off-duty {
  opacity: 0.55;
  filter: grayscale(40%);
}

.caregiver-item.is-off-duty:hover {
  opacity: 0.85;
  background: rgba(255, 255, 255, 0.05);
}

.active-indicator {
  position: absolute;
  right: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
}
</style>
