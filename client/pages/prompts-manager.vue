<template>
  <div class="prompts-manager">
    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <span>API 预设提示词</span>
          <el-button size="small" @click="refreshApiPrompts">
            <i class="fas fa-sync-alt"></i> 刷新
          </el-button>
        </div>
      </template>
      <el-table :data="apiPrompts" style="width: 100%" max-height="300">
        <el-table-column prop="name" label="名称" width="200" />
        <el-table-column prop="prompt" label="提示词" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="toggleApiPrompt(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="editPrompt(row, true)">编辑</el-button>
            <el-button size="small" @click="testPrompt(row)">测试</el-button>
            <el-button size="small" @click="copyToUser(row)">复制</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <span>用户自定义提示词</span>
          <el-button type="primary" size="small" @click="addUserPrompt">
            <i class="fas fa-plus"></i> 添加
          </el-button>
        </div>
      </template>
      <el-table :data="userPrompts" style="width: 100%">
        <el-table-column prop="name" label="名称" width="200" />
        <el-table-column prop="prompt" label="提示词" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="saveUserPrompts"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="editPrompt(row)">编辑</el-button>
            <el-button size="small" @click="testPrompt(row)">测试</el-button>
            <el-button size="small" type="danger" @click="deletePrompt(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" placeholder="提示词名称" :disabled="editingIndex === -2" />
        </el-form-item>
        <el-form-item label="提示词">
          <el-input
            v-model="editForm.prompt"
            type="textarea"
            :rows="6"
            placeholder="输入提示词，支持 {{userText}} 变量"
            :disabled="editingIndex === -2"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="editForm.enabled" :disabled="editingIndex === -2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ editingIndex === -2 ? '关闭' : '取消' }}</el-button>
        <el-button v-if="editingIndex !== -2" type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { send, message } from '@koishijs/client'

interface Prompt {
  name: string
  prompt: string
  enabled: boolean
}

const apiPrompts = ref<Prompt[]>([])
const userPrompts = ref<Prompt[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('')
const editForm = ref<Prompt>({
  name: '',
  prompt: '',
  enabled: true
})
const editingIndex = ref(-1)

// 加载 API prompts
async function loadApiPrompts() {
  try {
    const res: any = await send('banana/presets/list')
    const all = res?.data || []
    apiPrompts.value = all.filter((p: any) => p.source === 'api')
  } catch (error) {
    message.error('加载 API 提示词失败')
  }
}

// 加载用户 prompts
async function loadUserPrompts() {
  try {
    const data = await send('banana/presets/list')
    userPrompts.value = data || []
  } catch (error) {
    message.error('加载用户提示词失败')
  }
}

// 刷新 API prompts
async function refreshApiPrompts() {
  try {
    await send('banana/api-presets/sync')
    await loadApiPrompts()
    message.success('刷新成功')
  } catch (error) {
    message.error('刷新失败')
  }
}

// 保存用户 prompts
async function saveUserPrompts() {
  try {
    await send('banana-pro/save-user-prompts', userPrompts.value)
    message.success('保存成功')
  } catch (error) {
    message.error('保存失败')
  }
}

// 添加用户 prompt
function addUserPrompt() {
  editForm.value = {
    name: '',
    prompt: '',
    enabled: true
  }
  editingIndex.value = -1
  dialogTitle.value = '添加提示词'
  dialogVisible.value = true
}

// 编辑 prompt
function editPrompt(row: Prompt, isApiPrompt = false) {
  if (isApiPrompt) {
    // API 预设：只能查看，不能修改
    editForm.value = { ...row }
    editingIndex.value = -2  // 特殊标记：API 预设
    dialogTitle.value = '查看 API 提示词'
    dialogVisible.value = true
  } else {
    // 用户预设：可以编辑
    const index = userPrompts.value.indexOf(row)
    editForm.value = { ...row }
    editingIndex.value = index
    dialogTitle.value = '编辑提示词'
    dialogVisible.value = true
  }
}

// 保存编辑
function saveEdit() {
  if (editingIndex.value === -2) {
    // API 预设，只是查看，不保存
    dialogVisible.value = false
    return
  }
  
  if (!editForm.value.name || !editForm.value.prompt) {
    message.warning('请填写完整信息')
    return
  }

  if (editingIndex.value >= 0) {
    userPrompts.value[editingIndex.value] = { ...editForm.value }
  } else {
    userPrompts.value.push({ ...editForm.value })
  }

  saveUserPrompts()
  dialogVisible.value = false
}

// 删除 prompt
function deletePrompt(row: Prompt) {
  const index = userPrompts.value.indexOf(row)
  if (index >= 0) {
    userPrompts.value.splice(index, 1)
    saveUserPrompts()
  }
}

// 复制到用户 prompts（弹出对话框重命名）
function copyToUser(row: Prompt) {
  editForm.value = {
    name: row.name + ' (副本)',
    prompt: row.prompt,
    enabled: true
  }
  editingIndex.value = -1  // 新增模式
  dialogTitle.value = '复制为用户提示词'
  dialogVisible.value = true
}

// 测试 prompt
function testPrompt(row: Prompt) {
  message.info(`测试功能开发中：${row.name}`)
}

// 切换 API prompt 状态
async function toggleApiPrompt(row: Prompt) {
  try {
    // 保存所有 API prompts 的状态
    await send('banana-pro/save-api-prompts', apiPrompts.value)
    message.success('已更新 API 提示词状态')
  } catch (error) {
    message.error('更新失败')
    // 恢复原状态
    row.enabled = !row.enabled
  }
}

onMounted(() => {
  loadApiPrompts()
  loadUserPrompts()
  // 定时刷新
  setInterval(() => {
    loadApiPrompts()
    loadUserPrompts()
  }, 10000)
})
</script>

<style scoped>
.prompts-manager {
  padding: 20px;
}

.section-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
