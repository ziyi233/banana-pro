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

    <!-- 批量操作工具栏 -->
    <div v-if="selectedPresets.length > 0" class="batch-toolbar">
      <span class="selected-info">已选择 {{ selectedPresets.length }} 项</span>
      
      <el-button-group>
        <el-dropdown @command="handleExport">
          <el-button><el-icon><Download /></el-icon> 导出</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="file">💾 下载文件</el-dropdown-item>
              <el-dropdown-item command="clipboard">📋 复制到剪贴板</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        
        <el-button @click="openJsonEditor"><el-icon><Edit /></el-icon> JSON 编辑</el-button>
      </el-button-group>
      
      <el-button-group>
        <el-button @click="batchToggle(true)">启用</el-button>
        <el-button @click="batchToggle(false)">禁用</el-button>
      </el-button-group>
      
      <el-button type="danger" @click="batchDelete"><el-icon><Delete /></el-icon> 删除</el-button>
    </div>

    <!-- 导入按钮 -->
    <div class="import-section">
      <el-button @click="importDialog.visible = true"><el-icon><Upload /></el-icon> 导入预设</el-button>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="用户预设" name="user">
        <el-table :data="userPresets" v-loading="loading" style="width: 100%" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="55" />
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
        <el-table :data="apiPresets" v-loading="loading" style="width: 100%" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="55" />
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

    <!-- 编辑预设对话框 -->
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

    <!-- 导入对话框 -->
    <el-dialog v-model="importDialog.visible" title="导入预设" width="700px">
      <el-tabs v-model="importTab">
        <el-tab-pane label="上传文件" name="file">
          <el-upload
            drag
            :auto-upload="false"
            :on-change="handleFileImport"
            :show-file-list="false"
            accept=".json">
            <el-icon class="el-icon--upload"><Upload /></el-icon>
            <div class="el-upload__text">拖拽文件到此处或<em>点击上传</em></div>
            <template #tip>
              <div class="el-upload__tip">只支持 .json 文件</div>
            </template>
          </el-upload>
        </el-tab-pane>
        
        <el-tab-pane label="粘贴 JSON" name="paste">
          <el-input
            v-model="importJsonText"
            type="textarea"
            :rows="15"
            placeholder='粘贴 JSON 格式的预设数据，例如：&#10;{&#10;  "version": "1.0",&#10;  "presets": [&#10;    {&#10;      "name": "写实风格",&#10;      "prompt": "realistic, {{userText}}",&#10;      "enabled": true&#10;    }&#10;  ]&#10;}'
          />
          <div style="margin-top: 12px;">
            <el-button type="primary" @click="importFromText">导入</el-button>
            <el-button @click="formatImportJson">格式化</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <!-- 验证结果 -->
      <div v-if="importValidation.checked" class="validation-result">
        <el-alert
          v-if="importValidation.valid"
          type="success"
          :closable="false"
          show-icon>
          ✅ 格式正确，共 {{ importValidation.count }} 个预设
        </el-alert>
        <el-alert
          v-else
          type="error"
          :closable="false"
          show-icon>
          <div v-for="(error, index) in importValidation.errors" :key="index">
            {{ error }}
          </div>
        </el-alert>
      </div>
    </el-dialog>

    <!-- 导入预览对话框 -->
    <el-dialog v-model="importPreviewDialog.visible" title="导入预览" width="800px">
      <div class="import-preview-container">
        <!-- 策略选择 -->
        <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
          <div>
            <strong>即将导入 {{ importPreviewData.length }} 个预设</strong>
            <div v-if="importConflicts.length > 0" style="margin-top: 8px; color: #e6a23c;">
              ⚠️ 发现 {{ importConflicts.length }} 个同名预设，请选择处理方式
            </div>
          </div>
        </el-alert>

        <el-form v-if="importConflicts.length > 0" label-position="top" style="margin-bottom: 16px;">
          <el-form-item label="同名处理策略">
            <el-radio-group v-model="importStrategy">
              <el-radio value="skip">跳过同名预设（保留现有）</el-radio>
              <el-radio value="overwrite">覆盖同名预设（用新的替换）</el-radio>
              <el-radio value="rename">自动重命名（添加后缀）</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <!-- 预设列表 -->
        <div class="preview-list">
          <el-table :data="importPreviewData" max-height="400" border>
            <el-table-column prop="name" label="预设名称" width="200">
              <template #default="{ row }">
                <div :class="{ 'conflict-name': row.conflict }">
                  {{ row.name }}
                  <el-tag v-if="row.conflict" type="warning" size="small" style="margin-left: 8px;">
                    同名
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="prompt" label="Prompt" show-overflow-tooltip />
            <el-table-column prop="enabled" label="启用" width="80">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
                  {{ row.enabled ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <span v-if="row.conflict">
                  <span v-if="importStrategy === 'skip'" style="color: #909399;">跳过</span>
                  <span v-else-if="importStrategy === 'overwrite'" style="color: #e6a23c;">覆盖</span>
                  <span v-else style="color: #67c23a;">重命名</span>
                </span>
                <span v-else style="color: #67c23a;">新增</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 导入进度 -->
        <div v-if="importing" class="import-progress">
          <el-progress :percentage="importProgress" :status="importProgress === 100 ? 'success' : undefined" />
          <div style="margin-top: 8px; text-align: center; color: #909399;">
            正在导入... {{ importedCount }} / {{ importTotalCount }}
          </div>
        </div>

        <!-- 导入结果 -->
        <div v-if="importResult.show" class="import-result">
          <el-alert
            :type="importResult.success ? 'success' : 'error'"
            :closable="false"
            show-icon>
            <div>
              <strong>{{ importResult.message }}</strong>
              <ul v-if="importResult.details.length > 0" style="margin: 8px 0 0 0; padding-left: 20px;">
                <li v-for="(detail, index) in importResult.details" :key="index">
                  {{ detail }}
                </li>
              </ul>
            </div>
          </el-alert>
        </div>
      </div>

      <template #footer>
        <el-button @click="cancelImportPreview" :disabled="importing">取消</el-button>
        <el-button 
          type="primary" 
          @click="executeImport" 
          :loading="importing"
          :disabled="importing || importResult.show">
          {{ importing ? '导入中...' : '开始导入' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- JSON 编辑器对话框 -->
    <el-dialog v-model="jsonEditorDialog.visible" title="JSON 编辑器" width="900px" fullscreen>
      <div class="json-editor-container">
        <div class="editor-toolbar">
          <el-button @click="formatJsonEditor">格式化</el-button>
          <el-button @click="validateJsonEditor">验证</el-button>
          <el-button type="primary" @click="saveFromJsonEditor">保存修改</el-button>
          <el-button @click="jsonEditorDialog.visible = false">取消</el-button>
        </div>
        
        <el-input
          v-model="jsonEditorContent"
          type="textarea"
          :rows="30"
          class="json-editor"
          placeholder="编辑 JSON..."
        />
        
        <!-- 验证结果 -->
        <div v-if="jsonEditorValidation.checked" class="validation-result">
          <el-alert
            v-if="jsonEditorValidation.valid"
            type="success"
            :closable="false"
            show-icon>
            ✅ 格式正确，共 {{ jsonEditorValidation.count }} 个预设
          </el-alert>
          <el-alert
            v-else
            type="error"
            :closable="false"
            show-icon>
            <div v-for="(error, index) in jsonEditorValidation.errors" :key="index">
              {{ error }}
            </div>
          </el-alert>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { send, message } from '@koishijs/client'
import { Plus, Download, Upload, Edit, Delete } from '@element-plus/icons-vue'

type Preset = { id?: number; name: string; prompt: string; source: 'api' | 'user'; enabled: boolean }

interface PresetExportFormat {
  version: string
  presets: Array<{
    name: string
    prompt: string
    enabled: boolean
  }>
}

const loading = ref(false)
const syncing = ref(false)
const presets = ref<Preset[]>([])
const activeTab = ref('user')

const userPresets = computed(() => presets.value.filter(p => p.source === 'user'))
const apiPresets = computed(() => presets.value.filter(p => p.source === 'api'))

const dialog = ref({ visible: false, editing: false })
const form = ref<Preset>({ name: '', prompt: '', enabled: true, source: 'user' })
let editingId: number | undefined

// 批量操作相关
const selectedPresets = ref<Preset[]>([])

// 导入相关
const importDialog = ref({ visible: false })
const importTab = ref('file')
const importJsonText = ref('')
const importValidation = ref({ checked: false, valid: false, count: 0, errors: [] as string[] })

// 导入预览相关
const importPreviewDialog = ref({ visible: false })
const importPreviewData = ref<Array<{ name: string; prompt: string; enabled: boolean; conflict: boolean }>>([])
const importConflicts = ref<string[]>([])
const importStrategy = ref<'skip' | 'overwrite' | 'rename'>('rename')
const importing = ref(false)
const importProgress = ref(0)
const importedCount = ref(0)
const importTotalCount = ref(0)
const importResult = ref({ show: false, success: false, message: '', details: [] as string[] })

// JSON 编辑器相关
const jsonEditorDialog = ref({ visible: false })
const jsonEditorContent = ref('')
const jsonEditorValidation = ref({ checked: false, valid: false, count: 0, errors: [] as string[] })

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

// ========== 批量操作功能 ==========

function handleSelectionChange(selection: Preset[]) {
  selectedPresets.value = selection
}

// 导出功能
function handleExport(command: 'file' | 'clipboard') {
  if (selectedPresets.value.length === 0) {
    return message.warning('请先选择要导出的预设')
  }
  
  if (command === 'file') {
    exportToFile()
  } else {
    exportToClipboard()
  }
}

function generateExportData(): PresetExportFormat {
  return {
    version: '1.0',
    presets: selectedPresets.value.map(p => ({
      name: p.name,
      prompt: p.prompt,
      enabled: p.enabled
    }))
  }
}

function exportToFile() {
  const data = generateExportData()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `banana-presets-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success(`已导出 ${selectedPresets.value.length} 个预设`)
}

async function exportToClipboard() {
  const data = generateExportData()
  const json = JSON.stringify(data, null, 2)
  
  try {
    await navigator.clipboard.writeText(json)
    message.success(`已复制 ${selectedPresets.value.length} 个预设到剪贴板`)
  } catch (err) {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = json
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    message.success(`已复制 ${selectedPresets.value.length} 个预设到剪贴板`)
  }
}

// 导入功能
function handleFileImport(file: any) {
  const reader = new FileReader()
  reader.onload = async (e) => {
    const text = e.target?.result as string
    await processImportJson(text)
  }
  reader.readAsText(file.raw)
}

function importFromText() {
  processImportJson(importJsonText.value)
}

function formatImportJson() {
  try {
    const parsed = JSON.parse(importJsonText.value)
    importJsonText.value = JSON.stringify(parsed, null, 2)
    message.success('已格式化')
  } catch (err) {
    message.error('JSON 格式错误，无法格式化')
  }
}

async function processImportJson(jsonText: string) {
  const validation = validatePresetJson(jsonText)
  importValidation.value = {
    checked: true,
    valid: validation.valid,
    count: validation.data?.presets.length || 0,
    errors: validation.errors
  }
  
  if (!validation.valid) {
    return
  }
  
  // 检查同名冲突
  const existingNames = presets.value.map(p => p.name)
  const conflicts: string[] = []
  const previewData = validation.data!.presets.map(preset => {
    const conflict = existingNames.includes(preset.name)
    if (conflict) {
      conflicts.push(preset.name)
    }
    return {
      name: preset.name,
      prompt: preset.prompt,
      enabled: preset.enabled ?? true,
      conflict
    }
  })
  
  // 显示预览对话框
  importPreviewData.value = previewData
  importConflicts.value = conflicts
  importStrategy.value = conflicts.length > 0 ? 'rename' : 'skip'
  importing.value = false
  importProgress.value = 0
  importedCount.value = 0
  importTotalCount.value = previewData.length
  importResult.value = { show: false, success: false, message: '', details: [] }
  
  importDialog.value.visible = false
  importPreviewDialog.value.visible = true
}

// 执行导入
async function executeImport() {
  importing.value = true
  importProgress.value = 0
  importedCount.value = 0
  importResult.value = { show: false, success: false, message: '', details: [] }
  
  const details: string[] = []
  let successCount = 0
  let skipCount = 0
  let errorCount = 0
  
  try {
    for (let i = 0; i < importPreviewData.value.length; i++) {
      const preset = importPreviewData.value[i]
      
      // 如果是冲突且策略是跳过，则跳过
      if (preset.conflict && importStrategy.value === 'skip') {
        skipCount++
        details.push(`跳过: ${preset.name}`)
        importedCount.value++
        importProgress.value = Math.round((importedCount.value / importTotalCount.value) * 100)
        continue
      }
      
      try {
        let finalName = preset.name
        
        // 处理同名冲突
        if (preset.conflict) {
          if (importStrategy.value === 'overwrite') {
            // 覆盖：先删除旧的
            const existing = presets.value.find(p => p.name === preset.name)
            if (existing?.id) {
              await send('banana/presets/delete', { id: existing.id })
            }
            details.push(`覆盖: ${preset.name}`)
          } else if (importStrategy.value === 'rename') {
            // 重命名：添加后缀
            let counter = 1
            const existingNames = presets.value.map(p => p.name)
            while (existingNames.includes(finalName)) {
              finalName = `${preset.name} (${counter})`
              counter++
            }
            details.push(`重命名: ${preset.name} → ${finalName}`)
          }
        } else {
          details.push(`新增: ${preset.name}`)
        }
        
        // 创建预设
        await send('banana/presets/create', {
          name: finalName,
          prompt: preset.prompt,
          enabled: preset.enabled,
          source: 'user'
        })
        
        successCount++
      } catch (e: any) {
        errorCount++
        details.push(`失败: ${preset.name} - ${e.message}`)
      }
      
      importedCount.value++
      importProgress.value = Math.round((importedCount.value / importTotalCount.value) * 100)
      
      // 添加小延迟，让进度条更新更流畅
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // 显示结果
    importResult.value = {
      show: true,
      success: errorCount === 0,
      message: `导入完成！成功: ${successCount}, 跳过: ${skipCount}, 失败: ${errorCount}`,
      details
    }
    
    // 刷新列表
    await loadAll()
    
    // 重置导入对话框
    importJsonText.value = ''
    importValidation.value = { checked: false, valid: false, count: 0, errors: [] }
    
  } catch (e: any) {
    importResult.value = {
      show: true,
      success: false,
      message: '导入失败: ' + (e?.message || '未知错误'),
      details: []
    }
  } finally {
    importing.value = false
  }
}

// 取消导入预览
function cancelImportPreview() {
  if (importing.value) return
  
  importPreviewDialog.value.visible = false
  importDialog.value.visible = true
}

// JSON 编辑器功能
function openJsonEditor() {
  if (selectedPresets.value.length === 0) {
    return message.warning('请先选择要编辑的预设')
  }
  
  const data: PresetExportFormat = {
    version: '1.0',
    presets: selectedPresets.value.map(p => ({
      name: p.name,
      prompt: p.prompt,
      enabled: p.enabled
    }))
  }
  
  jsonEditorContent.value = JSON.stringify(data, null, 2)
  jsonEditorValidation.value = { checked: false, valid: false, count: 0, errors: [] }
  jsonEditorDialog.value.visible = true
}

function formatJsonEditor() {
  try {
    const parsed = JSON.parse(jsonEditorContent.value)
    jsonEditorContent.value = JSON.stringify(parsed, null, 2)
    message.success('已格式化')
  } catch (err) {
    message.error('JSON 格式错误，无法格式化')
  }
}

function validateJsonEditor() {
  const validation = validatePresetJson(jsonEditorContent.value)
  jsonEditorValidation.value = {
    checked: true,
    valid: validation.valid,
    count: validation.data?.presets.length || 0,
    errors: validation.errors
  }
}

async function saveFromJsonEditor() {
  const validation = validatePresetJson(jsonEditorContent.value)
  
  if (!validation.valid) {
    jsonEditorValidation.value = {
      checked: true,
      valid: false,
      count: 0,
      errors: validation.errors
    }
    return message.error('JSON 格式错误，请修正后再保存')
  }
  
  try {
    // 删除选中的旧预设
    for (const preset of selectedPresets.value) {
      if (preset.id) {
        await send('banana/presets/delete', { id: preset.id })
      }
    }
    
    // 创建新预设
    for (const preset of validation.data!.presets) {
      await send('banana/presets/create', {
        name: preset.name,
        prompt: preset.prompt,
        enabled: preset.enabled ?? true,
        source: 'user'
      })
    }
    
    message.success('保存成功')
    jsonEditorDialog.value.visible = false
    selectedPresets.value = []
    await loadAll()
  } catch (e: any) {
    message.error('保存失败: ' + (e?.message || '未知错误'))
  }
}

// 批量启用/禁用
async function batchToggle(enabled: boolean) {
  if (selectedPresets.value.length === 0) {
    return message.warning('请先选择预设')
  }
  
  try {
    for (const preset of selectedPresets.value) {
      await send('banana/presets/toggle', { id: preset.id, enabled })
    }
    message.success(`已${enabled ? '启用' : '禁用'} ${selectedPresets.value.length} 个预设`)
    await loadAll()
  } catch (e: any) {
    message.error('操作失败: ' + (e?.message || '未知错误'))
  }
}

// 批量删除
async function batchDelete() {
  if (selectedPresets.value.length === 0) {
    return message.warning('请先选择预设')
  }
  
  if (!confirm(`确定要删除选中的 ${selectedPresets.value.length} 个预设吗？`)) {
    return
  }
  
  try {
    for (const preset of selectedPresets.value) {
      if (preset.id) {
        await send('banana/presets/delete', { id: preset.id })
      }
    }
    message.success(`已删除 ${selectedPresets.value.length} 个预设`)
    selectedPresets.value = []
    await loadAll()
  } catch (e: any) {
    message.error('删除失败: ' + (e?.message || '未知错误'))
  }
}

// JSON 验证函数
function validatePresetJson(jsonText: string): {
  valid: boolean
  data?: PresetExportFormat
  errors: string[]
} {
  const errors: string[] = []
  
  try {
    const data = JSON.parse(jsonText)
    
    // 检查必需字段
    if (!data.presets || !Array.isArray(data.presets)) {
      errors.push('缺少 presets 数组')
      return { valid: false, errors }
    }
    
    // 检查每个预设
    data.presets.forEach((preset: any, index: number) => {
      if (!preset.name || typeof preset.name !== 'string') {
        errors.push(`预设 #${index + 1}: 缺少或无效的 name`)
      }
      if (!preset.prompt || typeof preset.prompt !== 'string') {
        errors.push(`预设 #${index + 1}: 缺少或无效的 prompt`)
      }
      if (preset.name && preset.name.length > 50) {
        errors.push(`预设 #${index + 1}: 名称过长（最多50字符）`)
      }
      if (preset.enabled !== undefined && typeof preset.enabled !== 'boolean') {
        errors.push(`预设 #${index + 1}: enabled 必须是布尔值`)
      }
    })
    
    // 检查重复名称
    const names = data.presets.map((p: any) => p.name).filter(Boolean)
    const duplicates = names.filter((name: string, index: number) => names.indexOf(name) !== index)
    if (duplicates.length > 0) {
      errors.push(`存在重复名称: ${[...new Set(duplicates)].join(', ')}`)
    }
    
    return {
      valid: errors.length === 0,
      data: errors.length === 0 ? data : undefined,
      errors
    }
  } catch (err: any) {
    return {
      valid: false,
      errors: ['JSON 格式错误: ' + err.message]
    }
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

/* 批量操作工具栏 */
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 16px;
}

.selected-info {
  font-size: 14px;
  color: var(--tech-text-secondary);
  margin-right: auto;
}

/* 导入区域 */
.import-section {
  margin-bottom: 16px;
}

/* 验证结果 */
.validation-result {
  margin-top: 16px;
}

/* JSON 编辑器 */
.json-editor-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--tech-border);
}

.json-editor {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

/* 导入预览 */
.import-preview-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-list {
  border: 1px solid var(--tech-border);
  border-radius: 4px;
  overflow: hidden;
}

.conflict-name {
  color: #e6a23c;
  font-weight: 500;
}

.import-progress {
  margin-top: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
}

.import-result {
  margin-top: 16px;
}
</style>
