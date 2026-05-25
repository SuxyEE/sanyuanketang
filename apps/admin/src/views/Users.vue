<template>
  <div class="users-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <span>用户管理</span>
          <div class="header-actions">
            <el-radio-group v-model="roleFilter" size="default">
              <el-radio-button value="">全部</el-radio-button>
              <el-radio-button value="teacher">教师</el-radio-button>
              <el-radio-button value="student">学生</el-radio-button>
              <el-radio-button value="admin">管理员</el-radio-button>
            </el-radio-group>
            <el-input v-model="searchText" placeholder="搜索姓名/学号" prefix-icon="Search" style="width: 200px" clearable />
            <el-button type="primary" icon="Plus" @click="openDialog()">添加用户</el-button>
          </div>
        </div>
      </template>

      <el-table :data="filteredUsers" stripe style="width: 100%">
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="studentNo" label="学号/工号" width="140" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="院系/专业" min-width="180" />
        <el-table-column prop="className" label="班级" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastLogin" label="最近登录" width="140" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row, $index }">
            <el-button text type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-button text :type="row.active ? 'warning' : 'success'" size="small" @click="toggleActive(row)">
              {{ row.active ? '禁用' : '启用' }}
            </el-button>
            <el-popconfirm title="确定删除该用户?" @confirm="deleteUser($index)">
              <template #reference>
                <el-button text type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination layout="total, sizes, prev, pager, next" :total="users.length" :page-sizes="[20, 50, 100]" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingUser ? '编辑用户' : '添加用户'" width="480px">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="姓名" required>
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item label="学号/工号">
          <el-input v-model="formData.studentNo" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="formData.role" style="width: 100%">
            <el-option label="学生" value="student" />
            <el-option label="教师" value="teacher" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="院系/专业">
          <el-input v-model="formData.department" />
        </el-form-item>
        <el-form-item label="班级">
          <el-input v-model="formData.className" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

interface UserItem {
  name: string
  studentNo: string
  role: 'teacher' | 'student' | 'admin'
  department: string
  className: string
  active: boolean
  lastLogin: string
}

const searchText = ref('')
const roleFilter = ref('')
const dialogVisible = ref(false)
const editingUser = ref<UserItem | null>(null)

const users = ref<UserItem[]>([
  { name: '李明', studentNo: 'T20201001', role: 'teacher', department: '工业机器人技术', className: '', active: true, lastLogin: '2026-05-23' },
  { name: '王芳', studentNo: 'T20201002', role: 'teacher', department: '数字化设计与制造', className: '', active: true, lastLogin: '2026-05-23' },
  { name: '张伟', studentNo: 'T20201003', role: 'teacher', department: '智能控制技术', className: '', active: true, lastLogin: '2026-05-22' },
  { name: '张三', studentNo: '2024010001', role: 'student', department: '工业机器人技术', className: '机器人2401班', active: true, lastLogin: '2026-05-23' },
  { name: '李四', studentNo: '2024010002', role: 'student', department: '工业机器人技术', className: '机器人2401班', active: true, lastLogin: '2026-05-23' },
  { name: '王五', studentNo: '2024020001', role: 'student', department: '数字化设计与制造', className: '数设2401班', active: true, lastLogin: '2026-05-22' },
  { name: '赵六', studentNo: '2024030001', role: 'student', department: '智能控制技术', className: '智控2402班', active: false, lastLogin: '2026-05-10' },
  { name: '管理员', studentNo: 'A001', role: 'admin', department: '教务处', className: '', active: true, lastLogin: '2026-05-23' },
])

const filteredUsers = computed(() => {
  let list = users.value
  if (roleFilter.value) list = list.filter(u => u.role === roleFilter.value)
  if (searchText.value) list = list.filter(u => u.name.includes(searchText.value) || u.studentNo.includes(searchText.value))
  return list
})

const formData = ref<Partial<UserItem>>({})

function roleLabel(r: string) { return r === 'teacher' ? '教师' : r === 'admin' ? '管理员' : '学生' }
function roleTagType(r: string) { return r === 'teacher' ? 'warning' : r === 'admin' ? 'danger' : '' }

function openDialog(user?: UserItem) {
  editingUser.value = user || null
  formData.value = user ? { ...user } : { name: '', studentNo: '', role: 'student', department: '', className: '', active: true }
  dialogVisible.value = true
}

function saveUser() {
  if (!formData.value.name || !formData.value.role) {
    ElMessage.warning('请填写完整信息')
    return
  }
  if (editingUser.value) {
    Object.assign(editingUser.value, formData.value)
    ElMessage.success('用户已更新')
  } else {
    users.value.push({ ...formData.value, active: true, lastLogin: '-' } as UserItem)
    ElMessage.success('用户已添加')
  }
  dialogVisible.value = false
}

function toggleActive(user: UserItem) {
  user.active = !user.active
  ElMessage.success(user.active ? '已启用' : '已禁用')
}

function deleteUser(index: number) {
  users.value.splice(index, 1)
  ElMessage.success('已删除')
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
  align-items: center;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
