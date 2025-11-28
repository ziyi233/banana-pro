  <template>                                                                                                             
    <div class="tech-container">
                                                                                         
      <div class="tech-header">                                                                                          
        <div>                                                                                                            
          <h2 class="tech-title"><el-icon><Setting /></el-icon> 系统配置</h2>                                            
          <p class="tech-subtitle">管理生成渠道（渠道名即指令名，例如 /{渠道名}）</p>                                    
        </div>                                                                                                           
        <el-button type="primary" @click="openChannelDialog()"><el-icon><Plus /></el-icon> 新增渠道</el-button>          
      </div>                                                                                                             
                                                                                                                         
      <div class="tech-card">                                                                                            
        <el-table :data="channels" style="width: 100%">                                                                  
          <el-table-column prop="name" label="渠道名称" width="180" />                                                   
          <el-table-column prop="apiMode" label="类型" width="120">                                                      
            <template #default="{ row }">                                                                                
              <el-tag :type="row.apiMode === 'dalle' ? 'primary' : 'success'" size="small"
  effect="plain">{{ row.apiMode.toUpperCase() }}</el-tag>                                                                
            </template>                                                                                                  
          </el-table-column>                                                                                             
          <el-table-column label="模型">                                                                                 
            <template #default="{ row }">{{ row.apiMode === 'chatluna' ? row.chatlunaModel : row.model }}</template>     
          </el-table-column>                                                                                             
          <el-table-column label="状态" width="100">                                                                     
            <template #default="{ row }">                                                                                
              <el-switch v-model="row.enabled" @change="() => toggleChannel(row)" />                                     
            </template>                                                                                                  
          </el-table-column>                                                                                             
          <el-table-column label="操作" width="150" fixed="right">                                                       
            <template #default="{ row }">                                                                                
              <el-button link type="primary" size="small" @click="openChannelDialog(row)">编辑</el-button>               
              <el-button link type="danger" size="small" @click="deleteChannel(row)">删除</el-button>                    
            </template>                                                                                                  
          </el-table-column>                                                                                             
        </el-table>                                                                                                      
      </div>                                                                                                             
                                                                                                                         
      <el-dialog v-model="channelDialog.visible" :title="channelDialog.isEdit ? '编辑渠道' : '新增渠道'" width="720px">  
        <el-form :model="channelForm" label-position="top">                                                              
          <el-form-item label="渠道名称" required>                                                                       
            <el-input v-model="channelForm.name" />                                                                      
          </el-form-item>                                                                                                
          <el-form-item label="描述">                                                                                    
            <el-input v-model="channelForm.description" />                                                               
          </el-form-item>                                                                                                
          <el-form-item label="类型" required>                                                                           
            <el-select v-model="channelForm.apiMode" style="width: 100%" @change="onModeChange">                         
              <el-option label="DALL-E / OpenAI" value="dalle" />                                                        
              <el-option label="ChatLuna" value="chatluna" />                                                            
            </el-select>                                                                                                 
          </el-form-item>                                                                                                
                                                                                                                         
          <!-- DALL-E 配置 -->                                                                                           
          <template v-if="channelForm.apiMode === 'dalle'">                                                              
            <div class="form-grid">                                                                                      
              <el-form-item label="API URL">                                                                             
                <el-input v-model="channelForm.apiUrl" placeholder="https://api.openai.com/v1" />                        
              </el-form-item>                                                                                            
              <el-form-item label="API Key">                                                                             
                <el-input v-model="channelForm.apiKey" type="password" show-password />                                  
              </el-form-item>                                                                                            
            </div>                                                                                                       
            <div class="form-grid">                                                                                      
              <el-form-item label="模型">                                                                                
                <el-input v-model="channelForm.model" placeholder="如 dall-e-3 / gpt-image-1" />                         
              </el-form-item>                                                                                            
              <el-form-item label="生成数量">                                                                            
                <el-input v-model.number="channelForm.n" type="number" />                                                
              </el-form-item>                                                                                            
            </div>                                                                                                       
            <div class="form-grid">                                                                                      
              <el-form-item label="尺寸（可空）">                                                                        
                <el-select v-model="channelForm.size" clearable placeholder="留空由后端决定" style="width: 100%">        
                  <el-option label="1024x1024" value="1024x1024" />                                                      
                  <el-option label="1024x1792 (竖)" value="1024x1792" />                                                 
                  <el-option label="1792x1024 (横)" value="1792x1024" />                                                 
                </el-select>                                                                                             
              </el-form-item>                                                                                            
              <el-form-item label="质量">                                                                                
                <el-select v-model="channelForm.quality" clearable style="width: 100%">                                  
                  <el-option label="standard" value="standard" />                                                        
                  <el-option label="hd" value="hd" />                                                                    
                </el-select>                                                                                             
              </el-form-item>                                                                                            
            </div>                                                                                                       
            <el-form-item label="风格">                                                                                  
              <el-select v-model="channelForm.style" clearable style="width: 100%">                                      
                <el-option label="vivid" value="vivid" />                                                                
                <el-option label="natural" value="natural" />                                                            
              </el-select>                                                                                               
            </el-form-item>                                                                                              
          </template>                                                                                                    
                                                                                                                         
          <!-- ChatLuna 配置 -->                                                                                         
          <template v-if="channelForm.apiMode === 'chatluna'">                                                           
            <el-form-item label="选择模型">                                                                              
              <el-select v-model="channelForm.chatlunaModel" placeholder="从 ChatLuna 模型列表选择" filterable           
  style="width: 100%">                                                                                                   
                <el-option v-for="m in chatlunaModels" :key="m.value" :label="m.label" :value="m.value" />               
              </el-select>                                                                                               
            </el-form-item>                                                                                              
          </template>                                                                                                    
                                                                                                                         
          <div class="form-grid">                                                                                        
            <el-form-item label="扣费">                                                                          
              <el-input v-model="channelForm.cost" placeholder="默认：0" />                                    
            </el-form-item>                                                                                              
            <el-form-item>                                                                                               
              <el-checkbox v-model="channelForm.enabled">启用此渠道</el-checkbox>                                        
            </el-form-item>                                                                                              
          </div>                                                                                                         
        </el-form>                                                                                                       
        <template #footer>                                                                                               
          <el-button @click="channelDialog.visible = false">取消</el-button>                                             
          <el-button type="primary" @click="saveChannel">保存</el-button>                                                
        </template>                                                                                                      
      </el-dialog>                                                                                                       
    </div>                                                                                                               
  </template>                                                                                                            
  <script setup lang="ts">                                                                                               
  import { ref, reactive, onMounted } from 'vue'                                                                         
  import { send, message, router } from '@koishijs/client'                                                                       
  import { Setting, Plus, Picture } from '@element-plus/icons-vue'                                                                
                                                                                                                         
  type Channel = {                                                                                                       
    id?: number                                                                                                          
    name: string                                                                                                         
    description?: string                                                                                                 
    enabled: boolean                                                                                                     
    apiMode: 'dalle' | 'chatluna'                                                                                        
    apiUrl?: string                                                                                                      
    apiKey?: string                                                                                                      
    model?: string                                                                                                       
    n?: number                                                                                                           
    size?: string                                                                                                        
    quality?: string                                                                                                     
    style?: string                                                                                                       
    chatlunaModel?: string                                                                                               
    cost?: number                                                                                                    
  }                                                                                                                      
                                                                                                                         
  const channels = ref<Channel[]>([])                                                                                    
  const channelDialog = reactive({ visible: false, isEdit: false })                                                      
  const channelForm = ref<Channel>({ name: '', description: '', enabled: true, apiMode: 'dalle', cost: '',    
  size: '' })                                                                                                            
  const chatlunaModels = ref<Array<{ value: string; label: string }>>([])                                                
                                                                                                                         
  async function loadChannels() {                                                                                        
    try {                                                                                                                
      const res: any = await send('banana/channels/list')                                                                
      channels.value = res?.data || []                                                                                   
    } catch {                                                                                                            
      message.error('加载渠道失败')                                                                                      
    }                                                                                                                    
  }                                                                                                                      
                                                                                                                         
  function openChannelDialog(row?: Channel) {                                                                            
    channelDialog.isEdit = !!row                                                                                         
    channelForm.value = row ? { ...row } : {                                                                             
      name: '', description: '', enabled: true, apiMode: 'dalle', cost: '',                                   
      apiUrl: '', apiKey: '', model: '', n: 1, size: '', quality: '', style: '', chatlunaModel: ''                       
    }                                                                                                                    
    channelDialog.visible = true                                                                                         
    if (channelForm.value.apiMode === 'chatluna') loadChatLunaModels()                                                   
  }                                                                                                                      
                                                                                                                         
  async function saveChannel() {                                                                                         
    try {                                                                                                                
      let res: any                                                                                                       
      if (channelDialog.isEdit && channelForm.value.id) {                                                                
        const { id, ...data } = channelForm.value as any                                                                 
        res = await send('banana/channels/update', { id, data })                                                         
      } else {                                                                                                           
        res = await send('banana/channels/create', channelForm.value)                                                    
      }                                                                                                                  
      if (res?.success) {                                                                                                
        message.success('保存成功')                                                                                      
        channelDialog.visible = false                                                                                    
        loadChannels()                                                                                                   
      } else {                                                                                                           
        message.error(res?.error || '保存失败')                                                                          
      }                                                                                                                  
    } catch (e: any) {                                                                                                   
      message.error('保存失败: ' + (e?.message || '未知错误'))                                                           
    }                                                                                                                    
  }                                                                                                                      
                                                                                                                         
  async function deleteChannel(row: Channel) {                                                                           
    if (!row?.id) return                                                                                                 
    if (!confirm('确定删除该渠道吗？')) return                                                                           
    await send('banana/channels/delete', { id: row.id })                                                                 
    loadChannels()                                                                                                       
  }                                                                                                                      
                                                                                                                         
  async function toggleChannel(row: Channel) {                                                                           
    try {                                                                                                                
      const res: any = await send('banana/channels/toggle', { id: row.id, enabled: row.enabled })                        
      if (!res?.success) { row.enabled = !row.enabled; message.error(res?.error || '更新失败') }                         
    } catch {                                                                                                            
      row.enabled = !row.enabled                                                                                         
      message.error('更新失败')                                                                                          
    }                                                                                                                    
  }                                                                                                                      
                                                                                                                         
  async function loadChatLunaModels() {                                                                                  
    try {                                                                                                                
      const res: any = await send('banana/chatluna/models')                                                              
      if (res?.success) chatlunaModels.value = res.data || []                                                            
    } catch {}                                                                                                           
  }                                                                                                                      
                                                                                                                         
  function onModeChange() {                                                                                              
    if (channelForm.value.apiMode === 'chatluna') loadChatLunaModels()                                                   
  }                                                                                                                      
                                                                                                                         
  function goToWebUI() {                                                                                                  
    router.push('/banana-pro')                                                                                           
  }                                                                                                                      
                                                                                                                         
  onMounted(loadChannels)                                                                                                
  </script>                                                                                                              
  <style scoped>                                                                                                         
  .tech-container { padding: 20px; max-width: 1200px; margin: 0 auto; }                                                  
  .tech-card { background: var(--tech-bg-surface); border: 1px solid var(--tech-border); padding: 16px; }                
  .tech-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }              
  .tech-title { margin: 0; display: flex; align-items: center; gap: 6px; }                                               
  .tech-subtitle { color: var(--tech-text-secondary); margin: 4px 0 0; font-size: 13px; }                                
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }                                               
  </style>