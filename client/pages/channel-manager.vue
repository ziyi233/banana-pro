<template>
  <div class="linear-page">
    <div class="page-header">
      <div class="header-content">
        <h1>🛠️ 渠道管理</h1>
        <p class="subtitle">配置和管理 AI 生成渠道</p>
      </div>
      <button class="linear-btn linear-btn-primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon> 添加渠道
      </button>
    </div>

    <div class="linear-card table-container">
      <el-table :data="channels" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="指令名" width="150">
          <template #default="{ row }">
            <span class="channel-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column prop="model" label="模型" width="150">
          <template #default="{ row }">
            <el-tag size="small" effect="dark" type="info">{{ row.model }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="消耗" width="120">
          <template #default="{ row }">
            <span class="cost-text">{{ row.cost }} {{ row.currency }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch 
              v-model="row.enabled" 
              @change="toggleChannel(row)"
              style="--el-switch-on-color: var(--linear-success)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <button class="linear-btn linear-btn-secondary" @click="editChannel(row)">
                编辑
              </button>
              <button class="linear-btn linear-btn-secondary delete-btn" @click="deleteChannel(row)">
                删除
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingChannel ? '编辑渠道' : '新建渠道'" 
      width="600px"
      class="linear-dialog"
    >
      <el-form :model="formData" label-position="top">
        <div class="form-grid">
          <el-form-item label="指令名">
            <el-input v-model="formData.name" placeholder="例如: dalle3" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="formData.description" placeholder="渠道描述" />
          </el-form-item>
        </div>
        
        <!-- API 模式选择 -->
        <el-form-item label="API 模式">
          <el-radio-group v-model="formData.apiMode" @change="onApiModeChange">
            <el-radio-button label="dalle">DALL-E / OpenAI</el-radio-button>
            <el-radio-button label="chatluna">ChatLuna</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <!-- DALL-E 配置 -->
        <template v-if="formData.apiMode === 'dalle'">
          <el-form-item label="API URL">
            <el-input v-model="formData.apiUrl" placeholder="https://api.openai.com/v1" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="formData.apiKey" type="password" show-password />
          </el-form-item>
          <div class="form-grid">
            <el-form-item label="模型">
              <el-input v-model="formData.model" placeholder="dall-e-3" />
            </el-form-item>
            <el-form-item label="生成数量">
              <el-input-number v-model="formData.n" :min="1" :max="10" style="width: 100%" />
            </el-form-item>
          </div>
          <el-form-item label="尺寸">
            <el-select v-model="formData.size" style="width: 100%">
              <el-option label="1024x1024 (正方形)" value="1024x1024" />
              <el-option label="1024x1792 (竖屏)" value="1024x1792" />
              <el-option label="1792x1024 (横屏)" value="1792x1024" />
            </el-select>
          </el-form-item>
        </template>
        
        <!-- ChatLuna 配置 -->
        <template v-if="formData.apiMode === 'chatluna'">
          <el-form-item label="选择模型">
            <el-select v-model="formData.model" placeholder="选择 ChatLuna 模型" filterable style="width: 100%">
              <el-option
                v-for="model in chatlunaModels"
                :key="model.value"
                :label="model.label"
                :value="model.value"
              />
            </el-select>
          </el-form-item>
        </template>
        
        <div class="form-grid">
          <el-form-item label="消耗金额">
            <el-input-number v-model="formData.cost" :step="10" style="width: 100%" />
          </el-form-item>
          <el-form-item label="货币单位">
            <el-input v-model="formData.currency" placeholder="default" />
          </el-form-item>
        </div>
        
        <el-form-item>
          <el-checkbox v-model="formData.enabled">立即启用此渠道</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <button class="linear-btn linear-btn-secondary" @click="showCreateDialog = false">取消</button>
          <button class="linear-btn linear-btn-primary" @click="saveChannel">保存配置</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { send, message } from '@koishijs/client'
import { Plus } from '@element-plus/icons-vue'

const channels = ref([])
const loading = ref(false)
const showCreateDialog = ref(false)
const editingChannel = ref(null)
const chatlunaModels = ref([])

const formData = ref({
  name: '',
  description: '',
  apiMode: 'dalle',
  apiUrl: '',
  apiKey: '',
  model: 'nano-banana',
  n: 1,
  size: '1024x1024',
  quality: '',
  style: '',
  cost: 0,
  currency: 'default',
  enabled: true
})

async function loadChannels() {
  loading.value = true
  try {
    const result: any = await send('banana/channels/list')
    if (result.success) channels.value = result.data
  } finally {
    loading.value = false
  }
}

async function toggleChannel(channel: any) {
  try {
    await send('banana/channels/toggle', { id: channel.id, enabled: channel.enabled })
    message.success('已更新状态')
  } catch (e) {
    channel.enabled = !channel.enabled
    message.error('更新失败')
  }
}

function editChannel(channel: any) {
  editingChannel.value = channel
  formData.value = { ...channel }
  showCreateDialog.value = true
}

async function deleteChannel(channel: any) {
  if (!confirm('确定要删除这个渠道吗?')) return
  try {
    await send('banana/channels/delete', { id: channel.id })
    message.success('已删除')
    await loadChannels()
  } catch (e) {
    message.error('删除失败')
  }
}

async function saveChannel() {
  try {
    const { id, ...data } = formData.value
    if (editingChannel.value) {
      await send('banana/channels/update', { id: editingChannel.value.id, data })
    } else {
      await send('banana/channels/create', data)
    }
    message.success('保存成功')
    showCreateDialog.value = false
    editingChannel.value = null
    await loadChannels()
  } catch (e) {
    message.error('保存失败')
  }
}

async function loadChatLunaModels() {
  try {
    const result: any = await send('banana/chatluna/models')
    if (result.success) {
      chatlunaModels.value = result.data
    }
  } catch (e) {
    console.error('加载 ChatLuna 模型失败:', e)
  }
}

function onApiModeChange(mode: string) {
  if (mode === 'chatluna') {
    loadChatLunaModels()
    formData.value.model = ''
  } else if (mode === 'dalle') {
    formData.value.model = 'nano-banana'
  }
}

watch(showCreateDialog, (val) => {
  if (val && formData.value.apiMode === 'chatluna') {
    loadChatLunaModels()
  }
})

onMounted(() => loadChannels())
</script>

<style scoped>
.linear-page {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--linear-text);
  margin: 0 0 4px 0;
}

.subtitle {
  font-size: 14px;
  color: var(--linear-text-secondary);
  margin: 0;
}

.table-container {
  overflow: hidden;
  background: var(--linear-surface);
}

.channel-name {
  font-weight: 500;
  color: var(--linear-text);
}

.cost-text {
  font-family: var(--font-mono);
  color: var(--linear-warning);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.delete-btn:hover {
  border-color: var(--linear-error);
  color: var(--linear-error);
  background: var(--linear-error-light);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Element Plus Overrides for this page */
:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.02);
  --el-table-border-color: var(--linear-border);
  --el-table-text-color: var(--linear-text-secondary);
  --el-table-header-text-color: var(--linear-text);
  --el-table-row-hover-bg-color: var(--linear-surface-hover);
}

:deep(.el-table th.el-table__cell) {
  font-weight: 500;
}

:deep(.el-dialog) {
  background: var(--linear-surface);
  border: 1px solid var(--linear-border);
  border-radius: var(--radius-lg);
}

:deep(.el-dialog__title) {
  color: var(--linear-text);
}

:deep(.el-dialog__body) {
  padding-top: 10px;
}
</style>
