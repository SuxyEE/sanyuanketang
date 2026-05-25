<template>
  <div class="courses-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <span>课程管理</span>
          <div class="header-actions">
            <el-input v-model="searchText" placeholder="搜索课程名称" prefix-icon="Search" style="width: 240px" clearable />
            <el-button type="primary" icon="Plus" @click="openDialog()">新增课程</el-button>
          </div>
        </div>
      </template>

      <el-table :data="filteredCourses" stripe style="width: 100%">
        <el-table-column prop="name" label="课程名称" min-width="200" />
        <el-table-column prop="subject" label="所属专业" width="180" />
        <el-table-column prop="teacher" label="授课教师" width="120" />
        <el-table-column prop="semester" label="学期" width="120" />
        <el-table-column prop="classes" label="班级数" width="80" align="center" />
        <el-table-column prop="lessons" label="课堂数" width="80" align="center" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '进行中' : '已结束' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row, $index }">
            <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-button text type="primary" size="small" @click="viewSchedule(row)">排课</el-button>
            <el-popconfirm title="确定删除该课程?" @confirm="deleteCourse($index)" confirm-button-text="删除" cancel-button-text="取消">
              <template #reference>
                <el-button text type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          layout="total, sizes, prev, pager, next"
          :total="courses.length"
          :page-sizes="[10, 20, 50]"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingCourse ? '编辑课程' : '新增课程'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form :model="formData" label-width="90px" label-position="left">
        <el-form-item label="课程名称" required>
          <el-input v-model="formData.name" placeholder="请输入课程名称" />
        </el-form-item>
        <el-form-item label="所属专业" required>
          <el-select v-model="formData.subject" placeholder="选择所属专业" style="width: 100%">
            <el-option v-for="s in subjects" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="授课教师" required>
          <el-input v-model="formData.teacher" placeholder="请输入教师姓名" />
        </el-form-item>
        <el-form-item label="学期">
          <el-input v-model="formData.semester" placeholder="如 2025-2026-2" />
        </el-form-item>
        <el-form-item label="班级数">
          <el-input-number v-model="formData.classes" :min="1" :max="20" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="formData.status">
            <el-radio value="active">进行中</el-radio>
            <el-radio value="ended">已结束</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCourse" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="scheduleVisible" title="排课管理" width="640px">
      <div class="schedule-content">
        <div class="schedule-header">
          <h4>{{ scheduleCourseName }}</h4>
          <el-button type="primary" size="small" icon="Plus" @click="addScheduleSlot">添加课时</el-button>
        </div>
        <el-table :data="scheduleSlots" stripe>
          <el-table-column prop="day" label="星期" width="100">
            <template #default="{ row }">
              <el-select v-model="row.day" size="small" style="width: 80px">
                <el-option v-for="d in weekDays" :key="d" :label="d" :value="d" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="time" label="时间" width="200">
            <template #default="{ row }">
              <el-time-picker v-model="row.timeRange" is-range range-separator="-" start-placeholder="开始" end-placeholder="结束" format="HH:mm" size="small" style="width: 180px" />
            </template>
          </el-table-column>
          <el-table-column prop="room" label="教室" min-width="120">
            <template #default="{ row }">
              <el-input v-model="row.room" size="small" placeholder="教室" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }">
              <el-button text type="danger" size="small" @click="scheduleSlots.splice($index, 1)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="scheduleVisible = false">关闭</el-button>
        <el-button type="primary" @click="saveSchedule">保存排课</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

interface CourseItem {
  name: string
  subject: string
  teacher: string
  semester: string
  classes: number
  lessons: number
  status: 'active' | 'ended'
}

const searchText = ref('')
const currentPage = ref(1)
const dialogVisible = ref(false)
const scheduleVisible = ref(false)
const saving = ref(false)
const editingCourse = ref<CourseItem | null>(null)
const scheduleCourseName = ref('')

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const subjects = [
  '工业机器人技术', '数字化设计与制造', '智能控制技术',
  '计算机网络技术', '新能源汽车技术', '应用化工技术',
]

const courses = ref<CourseItem[]>([
  { name: '工业机器人编程与操作', subject: '工业机器人技术', teacher: '李明', semester: '2025-2026-2', classes: 3, lessons: 24, status: 'active' },
  { name: '三维建模与逆向工程', subject: '数字化设计与制造', teacher: '王芳', semester: '2025-2026-2', classes: 2, lessons: 18, status: 'active' },
  { name: 'PLC控制技术基础', subject: '智能控制技术', teacher: '张伟', semester: '2025-2026-2', classes: 4, lessons: 32, status: 'active' },
  { name: '网络设备配置与管理', subject: '计算机网络技术', teacher: '刘洋', semester: '2025-2026-2', classes: 2, lessons: 16, status: 'active' },
  { name: '新能源汽车电控系统', subject: '新能源汽车技术', teacher: '陈磊', semester: '2025-2026-2', classes: 3, lessons: 20, status: 'active' },
  { name: '化工单元操作', subject: '应用化工技术', teacher: '赵敏', semester: '2025-2026-2', classes: 2, lessons: 14, status: 'ended' },
])

const filteredCourses = computed(() =>
  searchText.value
    ? courses.value.filter(c => c.name.includes(searchText.value) || c.teacher.includes(searchText.value) || c.subject.includes(searchText.value))
    : courses.value
)

const defaultForm = (): CourseItem => ({
  name: '', subject: '', teacher: '', semester: '2025-2026-2', classes: 1, lessons: 0, status: 'active',
})

const formData = ref<CourseItem>(defaultForm())

const scheduleSlots = ref<any[]>([])

function openDialog(course?: CourseItem) {
  if (course) {
    editingCourse.value = course
    formData.value = { ...course }
  } else {
    editingCourse.value = null
    formData.value = defaultForm()
  }
  dialogVisible.value = true
}

function saveCourse() {
  if (!formData.value.name || !formData.value.subject || !formData.value.teacher) {
    ElMessage.warning('请填写完整信息')
    return
  }
  saving.value = true
  setTimeout(() => {
    if (editingCourse.value) {
      Object.assign(editingCourse.value, formData.value)
      ElMessage.success('课程已更新')
    } else {
      courses.value.push({ ...formData.value })
      ElMessage.success('课程已创建')
    }
    saving.value = false
    dialogVisible.value = false
  }, 400)
}

function deleteCourse(index: number) {
  courses.value.splice(index, 1)
  ElMessage.success('已删除')
}

function viewSchedule(course: CourseItem) {
  scheduleCourseName.value = course.name
  scheduleSlots.value = [
    { day: '周一', timeRange: null, room: 'A301' },
    { day: '周三', timeRange: null, room: 'A301' },
  ]
  scheduleVisible.value = true
}

function addScheduleSlot() {
  scheduleSlots.value.push({ day: '周一', timeRange: null, room: '' })
}

function saveSchedule() {
  ElMessage.success('排课已保存')
  scheduleVisible.value = false
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.schedule-content {
  min-height: 200px;
}

.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.schedule-header h4 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
</style>
