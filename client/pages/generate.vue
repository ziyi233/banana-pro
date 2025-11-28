<template>
  <div class="tech-container">
    <div class="tech-header">
      <div>
        <h2 class="tech-title"><el-icon><Brush /></el-icon> 绘图工作台</h2>
        <p class="tech-subtitle">释放创意，让 AI 帮你实现想象中的画面</p>
      </div>
    </div>

    <div class="workspace-grid">
      <!-- Left: Settings Panel -->
      <div class="tech-card settings-panel">
        <el-form label-position="top">
          <el-form-item label="生成渠道">
            <el-select v-model="form.channelId" placeholder="选择一个渠道" style="width: 100%">
              <el-option v-for="c in channels" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="预设模板 (可选)">
            <el-select v-model="form.presetId" placeholder="选择预设模板" clearable style="width: 100%" @change="onPresetChange">
              <el-option v-for="p in presets" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </el-form-item>

          <!-- Display selected preset content -->
          <div v-if="selectedPreset" class="preset-display">
            <label class="preset-label">预设内容</label>
            <div class="preset-content">{{ selectedPreset.prompt }}</div>
          </div>

          <el-form-item label="额外描述 (可选)">
            <el-input
              v-model="form.userInput"
              type="textarea"
              :rows="4"
              placeholder="在预设基础上添加额外的描述..."
              resize="none"
            />
          </el-form-item>

          <el-form-item label="参考图片">
            <div class="image-upload-container">
              <div v-for="(img, index) in form.inputImages" :key="index" class="image-item">
                <img :src="img" class="uploaded-image" />
                <el-button 
                  class="delete-image-btn" 
                  type="danger" 
                  size="small" 
                  circle
                  @click.stop="removeImage(index)"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              
              <el-upload
                class="image-uploader"
                action="#"
                :auto-upload="false"
                :on-change="handleImageChange"
                :show-file-list="false"
                multiple
              >
                <div class="uploader-icon">
                  <el-icon><Plus /></el-icon>
                  <span>点击上传</span>
                </div>
              </el-upload>
            </div>
          </el-form-item>

          <el-button type="primary" class="generate-btn" :loading="loading" @click="generate">
            <el-icon><MagicStick /></el-icon> 立即生成
          </el-button>
        </el-form>
      </div>

      <!-- Right: Preview Area -->
      <div class="preview-area">
        <div v-if="loading" class="loading-state">
          <div class="loader"></div>
          <p>AI 正在绘制中，请稍候...</p>
        </div>
        
        <div v-else-if="resultImages.length > 0" class="result-grid">
          <div v-for="(img, idx) in resultImages" :key="idx" class="result-card">
            <el-image :src="img" :preview-src-list="resultImages" fit="cover" />
            <div class="result-actions">
              <el-button size="small" @click="download(img)">下载</el-button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <el-icon size="48"><Picture /></el-icon>
          <p>生成的图片将显示在这里</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { send, message } from '@koishijs/client'
import { Brush, Plus, MagicStick, Picture, Close } from '@element-plus/icons-vue'

const loading = ref(false)
const channels = ref<any[]>([])
const presets = ref<any[]>([])
const resultImages = ref<string[]>([])

// structured files for API request
const inputFiles = ref<Array<{ data: string | ArrayBuffer; mime: string; filename: string }>>([])

const form = ref<{ channelId: number | null; presetId: number | null; userInput: string; inputImages: string[]}>({
  channelId: null,
  presetId: null,
  userInput: '',
  inputImages: []
})

// Computed property for selected preset
const selectedPreset = computed(() => {
  if (!form.value.presetId) return null
  return presets.value.find((p: any) => p.id === form.value.presetId)
})

async function loadData() {
  try {
    const [chRes, presetsRes] = await Promise.all([
      send('banana/channels/list'),
      send('banana/presets/list')
    ])
    
    channels.value = chRes?.data || []
    const allPresets = presetsRes?.data || []
    
    // Only show enabled presets
    presets.value = allPresets.filter(p => p.enabled)
    
    // Auto-select first channel
    if (channels.value.length > 0 && !form.value.channelId) {
      form.value.channelId = channels.value[0].id
    }
  } catch (e) {
    console.error('加载数据失败:', e)
    message.error('加载失败')
  }
}

function handleImageChange(file: any) {
  const raw: File = file.raw || file
  if (!raw) return
  const reader = new FileReader()
  reader.onload = (e: any) => {
    const dataUrl: string = e.target.result
    form.value.inputImages.push(dataUrl)
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
    if (match) {
      const mime = match[1]
      const base64 = match[2]
      inputFiles.value.push({ data: base64, mime, filename: raw.name || `image-${Date.now()}` })
    }
  }
  reader.readAsDataURL(raw)
}

function onPresetChange() {
  // Just update the computed property, don't fill the input
}

function removeImage(index: number) {
  form.value.inputImages.splice(index, 1)
  inputFiles.value.splice(index, 1)
}

async function generate() {
  // Validate: need either preset or userInput
  if (!form.value.presetId && !form.value.userInput) {
    message.warning('请选择预设模板或输入描述')
    return
  }
  
  if (!form.value.channelId) {
    message.warning('请选择生成渠道')
    return
  }
  
  loading.value = true
  resultImages.value = []
  
  try {
    const res: any = await send('banana/generate', {
      channelId: form.value.channelId as number,
      presetId: form.value.presetId || undefined,
      userInput: form.value.userInput || '',
      inputImages: inputFiles.value.length > 0 ? inputFiles.value : undefined,
    })
    
    if (res?.success) {
      const images = Array.isArray(res.data?.outputImages) ? res.data.outputImages : []
      resultImages.value = images
      message.success('生成成功')
    } else {
      message.error(res?.error || '生成失败')
    }
  } catch (e) {
    console.error('生成失败:', e)
    message.error('生成失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function download(url) {
  const a = document.createElement('a')
  a.href = url
  a.download = `generated-${Date.now()}.png`
  a.click()
}

onMounted(loadData)
</script>

<style scoped>
.preset-display {
  margin-bottom: 20px;
}

.preset-label {
  display: block;
  font-size: 14px;
  color: var(--tech-text-secondary);
  margin-bottom: 8px;
}

.preset-content {
  background: var(--tech-bg-hover);
  border: 1px solid var(--tech-border);
  padding: 12px;
  font-size: 13px;
  color: var(--tech-text-primary);
  line-height: 1.6;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Image Uploader Styles */
.image-upload-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border: 1px solid var(--tech-border);
  overflow: hidden;
}

.image-item .uploaded-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-uploader {
  aspect-ratio: 1;
}

.image-uploader :deep(.el-upload) {
  width: 100%;
  height: 100%;
  border: 1px dashed var(--tech-border);
  background: var(--tech-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.image-uploader :deep(.el-upload:hover) {
  border-color: var(--tech-primary);
  background: #fff;
}

.uploader-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--tech-text-muted);
  font-size: 12px;
  gap: 6px;
}

.uploader-icon .el-icon {
  font-size: 24px;
}

.delete-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 10;
}
</style>
