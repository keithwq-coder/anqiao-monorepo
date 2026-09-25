const fs = require('fs')
const f = 'src/views/console/WorkspaceShell.vue'
let s = fs.readFileSync(f, 'utf8')

if (s.includes('openApplicationId')) {
  console.log('already wired')
  process.exit(0)
}

const importBlock = `import FamilyAccess from '../../features/ltc-workbench/pages/FamilyAccess.vue'
import ObjectContextHeader from '../../features/ltc-workbench/components/ObjectContextHeader.vue'
import HandoffTimeline from '../../features/ltc-workbench/components/HandoffTimeline.vue'
import MaterialVersionList from '../../features/ltc-workbench/components/MaterialVersionList.vue'
import { getApplicationTimeline, getApplicationMaterials } from '../../api/ltc-application'`

if (s.includes("import FamilyAccess from '../../features/ltc-workbench/pages/FamilyAccess.vue'")) {
  s = s.replace(
    "import FamilyAccess from '../../features/ltc-workbench/pages/FamilyAccess.vue'",
    importBlock,
  )
} else {
  throw new Error('FamilyAccess import not found')
}

const oldOpen = `function openTodo(todo: WorkbenchTodo) {
  console.info('[workbench] open todo', todo.route_key, todo.object_id)
}`

const newOpen = `const openApplicationId = ref<string | null>(null)
const openTimeline = ref<Awaited<ReturnType<typeof getApplicationTimeline>> | null>(null)
const openMaterials = ref<Awaited<ReturnType<typeof getApplicationMaterials>> | null>(null)

async function openTodo(todo: WorkbenchTodo) {
  if (todo.object_type === 'application' || todo.application_id) {
    const id = todo.application_id || todo.object_id
    openApplicationId.value = id
    try {
      const [t, m] = await Promise.all([
        getApplicationTimeline(id),
        getApplicationMaterials(id),
      ])
      openTimeline.value = t
      openMaterials.value = m
    } catch (e) {
      todoError.value = e instanceof Error ? e.message : '打开对象失败'
    }
  } else {
    console.info('[workbench] open todo', todo.route_key, todo.object_id)
  }
}

function closeTodoObject() {
  openApplicationId.value = null
  openTimeline.value = null
  openMaterials.value = null
}`

if (!s.includes(oldOpen)) {
  console.error('openTodo block not found')
  process.exit(1)
}
s = s.replace(oldOpen, newOpen)

const oldList = `              <TodayTodoList
                :todos="todos"
                :loading="todosLoading"
                :error="todoError"
                @open="openTodo"
                @retry="loadWorkbench"
              />`

const newList = `              <TodayTodoList
                :todos="todos"
                :loading="todosLoading"
                :error="todoError"
                @open="openTodo"
                @retry="loadWorkbench"
              />
              <div v-if="openApplicationId && openTimeline" class="todo-object-open">
                <ObjectContextHeader
                  object-type="application"
                  :object-id="openApplicationId"
                  :state="openTimeline.public_state"
                  back-label="收起对象"
                  @back="closeTodoObject"
                />
                <HandoffTimeline
                  :events="openTimeline.list"
                  :next-action="openTimeline.next_action"
                  :published-result="openTimeline.published_result"
                />
                <MaterialVersionList
                  v-if="openMaterials"
                  style="margin-top: 8px"
                  :items="openMaterials.list"
                  :application-status="openMaterials.status"
                />
              </div>`

if (!s.includes(oldList)) {
  console.error('TodayTodoList block not found')
  process.exit(1)
}
s = s.replace(oldList, newList)

// clear open object on logout / workspace switch
s = s.replace(
  'function handleLogout() {\n  summary.value = null',
  'function handleLogout() {\n  openApplicationId.value = null\n  openTimeline.value = null\n  openMaterials.value = null\n  summary.value = null',
)
s = s.replace(
  'selectedWorkspace.value = key\n  summary.value = null',
  'selectedWorkspace.value = key\n  openApplicationId.value = null\n  openTimeline.value = null\n  openMaterials.value = null\n  summary.value = null',
)

fs.writeFileSync(f, s)
console.log('shell openTodo wired', s.includes('openApplicationId'), s.includes('ObjectContextHeader'))
