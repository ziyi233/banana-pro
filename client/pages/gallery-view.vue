<template>
  <div class="tech-container">
    <div class="tech-header">
      <div>
        <h2 class="tech-title"><el-icon><Picture /></el-icon> 画廊广场</h2>
        <p class="tech-subtitle">探索社区生成的精彩作品</p>
      </div>
      <el-button @click="refresh">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <div class="gallery-grid">
      <div v-for="item in gallery" :key="item.id" class="tech-card gallery-card">
        <div class="image-wrapper">
          <el-image :src="item.imageUrl" fit="cover" loading="lazy" :preview-src-list="[item.imageUrl]" />
        </div>
        <div class="card-info">
          <div class="prompt">{{ item.prompt }}</div>
          <div class="meta">
            <span class="user">{{ item.user }}</span>
            <span class="date">{{ formatDate(item.createTime) }}</span>
          </div>
          <el-button size="small" class="copy-btn" @click="copyPrompt(item)">复制提示词</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { send, message } from '@koishijs/client'
import { Picture, Refresh } from '@element-plus/icons-vue'

type GalleryItem = { id: number; imageUrl: string; prompt: string; user: string; createTime: string }
const gallery = ref<GalleryItem[]>([])

async function refresh() {
  try {
    const res: any = await send('banana/tasks/list', { page: 1, limit: 60 })
    const tasks = res?.data?.tasks || []
    const items: GalleryItem[] = []
    for (const t of tasks) {
      if (t.status !== 'success') continue
      let imgs: string[] = []
      try { imgs = JSON.parse(t.outputImages || '[]') } catch {}
      if (!imgs || imgs.length === 0) continue
      items.push({
        id: t.id,
        imageUrl: imgs[0],
        prompt: t.finalPrompt || t.userInput || '',
        user: t.username || '用户',
        createTime: t.startTime,
      })
    }
    gallery.value = items
  } catch (e) {
    message.error('加载失败')
  }
}

function copyPrompt(item) {
  navigator.clipboard.writeText(item.prompt)
  message.success('已复制')
}

function formatDate(str) {
  return new Date(str).toLocaleDateString()
}

onMounted(refresh)
</script>
