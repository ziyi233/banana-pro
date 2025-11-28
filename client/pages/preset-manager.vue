<template>
  <div class="preset-page">
    <div class="header">
      <div>
        <h2>预设管理</h2>
        <p class="sub">用户预设可编辑；API 预设只读，支持启用/禁用与复制</p>
      </div>
      <div class="actions">
        <el-button type="primary" @click="openCreate()"><el-icon><Plus /></el-icon> 新建预设</el-button>
        <el-button @click="syncApi" :loading="syncing">同步 API 预设</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="用户预设" name="user">
        <el-table :data="userPresets" v-loading="loading" style="width: 100%">
          <el-table-column prop="name" label="名称" width="200" />
          <el-table-column prop="prompt" label="内容" show-overflow-tooltip />
          <el-table-column label="启用" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" @change="() => toggle(row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="edit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="API 预设" name="api">
        <el-table :data="apiPresets" v-loading="loading" style="width: 100%">
          <el-table-column prop="name" label="名称" width="200" />
          <el-table-column prop="prompt" label="内容" show-overflow-tooltip />
          <el-table-column label="启用" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" @change="() => toggle(row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="copyApi(row)">复制为用户预设</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialog.visible" :title="dialog.editing ? '编辑预设' : '新建预设'" width="600px">
      <el-form :model="form" label-position="top">
        <el-form-item label="预设名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="Prompt 模板" required>
          <el-input v-model="form.prompt" type="textarea" :rows="6" placeholder="使用 {{userText}} 代表用户输入" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.enabled">启用此预设</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { send, message } from '@koishijs/client'
import { Plus } from '@element-plus/icons-vue'

type Preset = { id?: number; name: string; prompt: string; source: 'api' | 'user'; enabled: boolean }

const loading = ref(false)
const syncing = ref(false)
const presets = ref<Preset[]>([])
const activeTab = ref('user')

const userPresets = computed(() => presets.value.filter(p => p.source === 'user'))
const apiPresets = computed(() => presets.value.filter(p => p.source === 'api'))

const dialog = ref({ visible: false, editing: false })
const form = ref<Preset>({ name: '', prompt: '', enabled: true, source: 'user' })
let editingId: number | undefined

async function loadAll() {
  loading.value = true
  try {
    const res: any = await send('banana/presets/list')
    presets.value = res?.data || []
  } catch (e: any) {
    message.error('加载失败: ' + (e?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  dialog.value = { visible: true, editing: false }
  editingId = undefined
  form.value = { name: '', prompt: '', enabled: true, source: 'user' }
}

function edit(row: Preset) {
  dialog.value = { visible: true, editing: true }
  editingId = row.id
  form.value = { name: row.name, prompt: row.prompt, enabled: row.enabled, source: 'user' }
}

async function save() {
  try {
    if (dialog.value.editing && editingId) {
      const res: any = await send('banana/presets/update', { id: editingId, data: { name: form.value.name, prompt: form.value.prompt, enabled: form.value.enabled } })
      if (!res?.success) return message.error(res?.error || '更新失败')
      message.success('更新成功')
    } else {
      const res: any = await send('banana/presets/create', { name: form.value.name, prompt: form.value.prompt, source: 'user', enabled: form.value.enabled })
      if (!res?.success) return message.error(res?.error || '创建失败')
      message.success('创建成功')
    }
    dialog.value.visible = false
    await loadAll()
  } catch (e: any) {
    message.error('保存失败: ' + (e?.message || '未知错误'))
  }
}

async function remove(row: Preset) {
  if (!row?.id) return
  if (!confirm(`确定要删除预设 "${row.name}" 吗？`)) return
  await send('banana/presets/delete', { id: row.id })
  await loadAll()
}

async function toggle(row: Preset) {
  try {
    const res: any = await send('banana/presets/toggle', { id: row.id, enabled: row.enabled })
    if (!res?.success) {
      row.enabled = !row.enabled
      return message.error(res?.error || '更新失败')
    }
  } catch (e: any) {
    row.enabled = !row.enabled
    message.error('更新失败: ' + (e?.message || '未知错误'))
  }
}

async function syncApi() {
  syncing.value = true
  try {
    const res: any = await send('banana/api-presets/sync')
    if (res?.success) message.success('API 预设已同步')
    await loadAll()
  } finally {
    syncing.value = false
  }
}

async function copyApi(row: Preset) {
  try {
    const res: any = await send('banana/api-presets/copy', { name: row.name, prompt: row.prompt })
    if (res?.success) {
      message.success('已复制到用户预设')
      await loadAll()
    } else {
      message.error(res?.error || '复制失败')
    }
  } catch (e: any) {
    message.error('复制失败: ' + (e?.message || '未知错误'))
  }
}

onMounted(loadAll)
</script>

<style scoped>
.preset-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.header h2 { margin: 0; font-weight: 600; }
.sub { color: #666; margin: 4px 0 0; font-size: 13px; }
.actions { display: flex; gap: 8px; }
</style>
