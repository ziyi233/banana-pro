<template>
  <div class="command-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>指令别名管理</span>
          <el-button type="primary" size="small" @click="addCommand">
            <i class="fas fa-plus"></i> 添加指令
          </el-button>
        </div>
      </template>

      <el-table :data="commands" style="width: 100%">
        <el-table-column prop="name" label="指令名称" width="150" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="API 模式" width="120">
          <template #default="{ row }">
            <el-tag :type="row.apiMode === 'dalle' ? 'primary' : 'success'">
              {{ row.apiMode === 'dalle' ? 'DALL-E' : 'ChatLuna' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model" label="模型" width="150" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="toggleCommand(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editCommand(row)">编辑</el-button>
            <el-button size="small" @click="testCommand(row)">测试</el-button>
            <el-button size="small" type="danger" @click="deleteCommand(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form :model="editForm" label-width="120px">
        <el-tabs v-model="activeTab">
          <!-- 基础信息 -->
          <el-tab-pane label="基础信息" name="basic">
            <el-form-item label="指令名称" required>
              <el-input v-model="editForm.name" placeholder="例如: dalle3" />
              <div class="form-tip">用户将通过 /banana {{editForm.name}} 调用此指令</div>
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="editForm.description" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="API 模式" required>
              <el-radio-group v-model="editForm.apiMode">
                <el-radio label="dalle">DALL-E</el-radio>
                <el-radio label="chatluna">ChatLuna</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-tab-pane>

          <!-- API 配置 -->
          <el-tab-pane label="API 配置" name="api">
            <el-form-item label="Base URL" required>
              <el-input v-model="editForm.baseUrl" placeholder="https://api.openai.com/v1/images/generations" />
            </el-form-item>
            <el-form-item label="API Key" required>
              <el-input v-model="editForm.apiKey" type="password" show-password placeholder="sk-..." />
            </el-form-item>
            <el-form-item label="模型" required>
              <el-input v-model="editForm.model" placeholder="dall-e-3 或 gpt-4o" />
            </el-form-item>
            <el-form-item label="超时时间(秒)">
              <el-input-number v-model="editForm.timeout" :min="10" :max="300" />
            </el-form-item>
            <el-form-item label="最大重试次数">
              <el-input-number v-model="editForm.maxRetries" :min="0" :max="5" />
            </el-form-item>
          </el-tab-pane>

          <!-- DALL-E 参数 -->
          <el-tab-pane label="DALL-E 参数" name="dalle" v-if="editForm.apiMode === 'dalle'">
            <div class="form-tip" style="margin-bottom: 15px">
              配置 DALL-E API 的 FormData 参数。使用 {{prompt}} 表示提示词，{{inputimage}} 表示输入图片。
            </div>
            <el-form-item label="API 参数">
              <el-button size="small" @click="addDalleParam">添加参数</el-button>
            </el-form-item>
            <div v-for="(param, index) in dalleParamsList" :key="index" class="param-row">
              <el-input v-model="param.key" placeholder="参数名" style="width: 200px" />
              <el-input v-model="param.value" placeholder="参数值" style="width: 400px; margin-left: 10px" />
              <el-button size="small" type="danger" @click="removeDalleParam(index)" style="margin-left: 10px">
                删除
              </el-button>
            </div>
            <div class="form-tip" style="margin-top: 10px">
              常用参数示例：<br/>
              • prompt: {{prompt}}<br/>
              • image: {{inputimage}}<br/>
              • n: 1<br/>
              • size: 1024x1024<br/>
              • quality: hd<br/>
              • style: vivid
            </div>
          </el-tab-pane>

          <!-- ChatLuna 参数 -->
          <el-tab-pane label="ChatLuna 参数" name="chatluna" v-if="editForm.apiMode === 'chatluna'">
            <el-form-item label="Temperature">
              <el-slider v-model="editForm.chatlunaTemperature" :min="0" :max="2" :step="0.1" show-input />
            </el-form-item>
            <el-form-item label="Max Tokens">
              <el-input-number v-model="editForm.chatlunaMaxTokens" :min="1" :max="4096" />
            </el-form-item>
            <el-form-item label="Top P">
              <el-slider v-model="editForm.chatlunaTopP" :min="0" :max="1" :step="0.1" show-input />
            </el-form-item>
          </el-tab-pane>

          <!-- Prompt 配置 -->
          <el-tab-pane label="Prompt 配置" name="prompt">
            <el-form-item label="Prompt 类型">
              <el-radio-group v-model="editForm.promptType">
                <el-radio label="none">无（直接使用用户输入）</el-radio>
                <el-radio label="api">API Prompt</el-radio>
                <el-radio label="user">用户 Prompt</el-radio>
                <el-radio label="custom">自定义</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="选择 Prompt" v-if="editForm.promptType === 'api' || editForm.promptType === 'user'">
              <el-select v-model="editForm.promptId" placeholder="请选择" style="width: 100%">
                <el-option
                  v-for="p in filteredPrompts"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="自定义 Prompt" v-if="editForm.promptType === 'custom'">
              <el-input
                v-model="editForm.customPrompt"
                type="textarea"
                :rows="6"
                placeholder="支持 {{userText}} 变量"
              />
            </el-form-item>
          </el-tab-pane>

          <!-- 货币配置 -->
          <el-tab-pane label="货币配置" name="monetary">
            <el-form-item label="启用货币">
              <el-switch v-model="editForm.enableMonetary" />
            </el-form-item>
            <el-form-item label="货币类型" v-if="editForm.enableMonetary">
              <el-input v-model="editForm.currency" placeholder="default" />
            </el-form-item>
            <el-form-item label="每次消耗" v-if="editForm.enableMonetary">
              <el-input-number v-model="editForm.cost" placeholder="-1000" />
              <div class="form-tip">负数表示扣除，正数表示奖励</div>
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCommand">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { send, message } from '@koishijs/client'

interface CommandAlias {
  id?: number
  name: string
  enabled: boolean
  description: string
  apiMode: 'dalle' | 'chatluna'
  baseUrl: string
  apiKey: string
  model: string
  dalleParams: string
  chatlunaTemperature: number
  chatlunaMaxTokens: number
  chatlunaTopP: number
  promptType: 'api' | 'user' | 'custom' | 'none'
  promptId?: number
  customPrompt: string
  enableMonetary: boolean
  currency: string
  cost: number
  timeout: number
  maxRetries: number
}

interface Prompt {
  id: number
  name: string
  prompt: string
  source: 'api' | 'user'
  enabled: boolean
}

const commands = ref<CommandAlias[]>([])
const prompts = ref<Prompt[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('')
const activeTab = ref('basic')
const editForm = ref<CommandAlias>({
  name: '',
  enabled: true,
  description: '',
  apiMode: 'dalle',
  baseUrl: '',
  apiKey: '',
  model: '',
  dalleParams: '{}',
  chatlunaTemperature: 0.7,
  chatlunaMaxTokens: 2000,
  chatlunaTopP: 1,
  promptType: 'none',
  customPrompt: '',
  enableMonetary: false,
  currency: 'default',
  cost: -1000,
  timeout: 60,
  maxRetries: 3
})

// DALL-E 参数列表
const dalleParamsList = ref<Array<{ key: string; value: string }>>([])

// 过滤后的 prompts
const filteredPrompts = computed(() => {
  if (editForm.value.promptType === 'api') {
    return prompts.value.filter(p => p.source === 'api' && p.enabled)
  } else if (editForm.value.promptType === 'user') {
    return prompts.value.filter(p => p.source === 'user' && p.enabled)
  }
  return []
})

// 加载指令列表
async function loadCommands() {
  try {
    const data: any = await send('banana/channels/list')
    commands.value = data || []
  } catch (error) {
    message.error('加载指令列表失败')
  }
}

// 加载 Prompt 列表
async function loadPrompts() {
  try {
    const [api, user] = await Promise.all([
      send('banana-pro/refresh-api-prompts'),
      send('banana/presets/list')
    ])
    prompts.value = [
      ...(api || []).map((p: any) => ({ ...p, source: 'api' })),
      ...(user || []).map((p: any) => ({ ...p, source: 'user' }))
    ]
  } catch (error) {
    message.error('加载 Prompt 列表失败')
  }
}

// 添加指令
function addCommand() {
  editForm.value = {
    name: '',
    enabled: true,
    description: '',
    apiMode: 'dalle',
    baseUrl: '',
    apiKey: '',
    model: '',
    dalleParams: '{}',
    chatlunaTemperature: 0.7,
    chatlunaMaxTokens: 2000,
    chatlunaTopP: 1,
    promptType: 'none',
    customPrompt: '',
    enableMonetary: false,
    currency: 'default',
    cost: -1000,
    timeout: 60,
    maxRetries: 3
  }
  dalleParamsList.value = []
  dialogTitle.value = '添加指令'
  activeTab.value = 'basic'
  dialogVisible.value = true
}

// 编辑指令
function editCommand(row: CommandAlias) {
  editForm.value = { ...row }
  
  // 解析 DALL-E 参数
  try {
    const params = JSON.parse(row.dalleParams || '{}')
    dalleParamsList.value = Object.entries(params).map(([key, value]) => ({
      key,
      value: String(value)
    }))
  } catch {
    dalleParamsList.value = []
  }
  
  dialogTitle.value = '编辑指令'
  activeTab.value = 'basic'
  dialogVisible.value = true
}

// 保存指令
async function saveCommand() {
  if (!editForm.value.name) {
    message.warning('请填写指令名称')
    return
  }
  
  // 构建 DALL-E 参数
  if (editForm.value.apiMode === 'dalle') {
    const params: Record<string, string> = {}
    dalleParamsList.value.forEach(p => {
      if (p.key) params[p.key] = p.value
    })
    editForm.value.dalleParams = JSON.stringify(params)
  }
  
  try {
    await send('banana-pro/save-command' as any, editForm.value)
    message.success('保存成功')
    dialogVisible.value = false
    loadCommands()
  } catch (error) {
    message.error('保存失败')
  }
}

// 切换启用状态
async function toggleCommand(row: CommandAlias) {
  try {
    await send('banana-pro/toggle-command' as any, { id: row.id, enabled: row.enabled })
    message.success(row.enabled ? '已启用' : '已禁用')
    loadCommands()
  } catch (error) {
    message.error('操作失败')
    row.enabled = !row.enabled
  }
}

// 删除指令
async function deleteCommand(row: CommandAlias) {
  try {
    await send('banana-pro/delete-command' as any, { id: row.id })
    message.success('删除成功')
    loadCommands()
  } catch (error) {
    message.error('删除失败')
  }
}

// 测试指令
function testCommand(row: CommandAlias) {
  message.info(`测试功能开发中：${row.name}`)
}

// 添加 DALL-E 参数
function addDalleParam() {
  dalleParamsList.value.push({ key: '', value: '' })
}

// 删除 DALL-E 参数
function removeDalleParam(index: number) {
  dalleParamsList.value.splice(index, 1)
}

onMounted(() => {
  loadCommands()
  loadPrompts()
})
</script>

<style scoped>
.command-manager {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 5px;
}

.param-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
</style>
