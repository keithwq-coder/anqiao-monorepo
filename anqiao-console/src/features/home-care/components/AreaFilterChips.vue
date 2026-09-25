<script setup lang="ts">
import { computed } from 'vue'
import { useHomeCareStore } from '../home-care-store'

const store = useHomeCareStore()

const areaChips = [
  { key: 'all', label: '全区 (72人)' },
  { key: 'canglang', label: '沧浪片区 (26人)' },
  { key: 'shuangta', label: '双塔片区 (26人)' },
  { key: 'sanxiang', label: '三香片区 (20人)' },
] as const

const stateChips = [
  { key: 'all', label: '全部状态' },
  { key: '在家长者', label: '在家长者' },
  { key: '异常预警', label: '⚠️ 异常预警' },
  { key: '独居', label: '独居高危' },
  { key: '重度失能', label: '重度失能' },
] as const
</script>

<template>
  <div class="area-filter-chips-bar">
    <div class="chips-left">
      <!-- 片区快速 Chips -->
      <div class="chips-group" role="tablist" aria-label="片区筛选">
        <button
          v-for="chip in areaChips"
          :key="chip.key"
          :class="['chip-btn', 'area-chip', store.selectedAreaKey.value === chip.key && 'active']"
          @click="store.setArea(chip.key)"
          type="button"
        >
          {{ chip.label }}
        </button>
      </div>

      <div class="chips-divider"></div>

      <!-- 状态快速 Chips -->
      <div class="chips-group" role="tablist" aria-label="状态筛选">
        <button
          v-for="st in stateChips"
          :key="st.key"
          :class="[
            'chip-btn',
            'state-chip',
            store.selectedStateFilter.value === st.key && 'active',
            st.key === '异常预警' && 'is-warn',
          ]"
          @click="store.selectedStateFilter.value = st.key"
          type="button"
        >
          {{ st.label }}
        </button>
      </div>
    </div>

    <!-- 搜索输入框 -->
    <div class="chips-right">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="store.searchQuery.value"
          type="text"
          placeholder="搜索长者姓名、门牌地址、联系电话、签约助老员..."
          class="search-input"
        />
        <button
          v-if="store.searchQuery.value"
          class="clear-search-btn"
          @click="store.searchQuery.value = ''"
          title="清空搜索"
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.area-filter-chips-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  backdrop-filter: blur(8px);
  flex-wrap: wrap;
}

.chips-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.chips-group {
  display: flex;
  gap: 6px;
}

.chips-divider {
  width: 1px;
  height: 20px;
  background: rgba(148, 163, 184, 0.2);
}

.chip-btn {
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(30, 41, 59, 0.5);
  color: #94a3b8;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.chip-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.3);
}

.area-chip.active {
  background: #0ea5e9;
  border-color: #0ea5e9;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
}

.state-chip.active {
  background: rgba(56, 189, 248, 0.18);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.state-chip.is-warn.active {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #fca5a5;
}

.chips-right {
  display: flex;
  align-items: center;
  min-width: 280px;
  flex: 1;
  max-width: 380px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 13px;
  color: #64748b;
  pointer-events: none;
}

.search-input {
  width: 100%;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  padding: 6px 32px 6px 30px;
  font-size: 12px;
  color: #f8fafc;
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
  background: rgba(30, 41, 59, 0.95);
}

.search-input::placeholder {
  color: #64748b;
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}

.clear-search-btn:hover {
  color: #ffffff;
}
</style>
