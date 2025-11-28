<template>
  <div class="task-center">
    <div class="header">
      <h2>📝 任务记录</h2>
      <el-button @click="loadTasks">🔄 刷新</el-button>
    </div>

    <el-table :data="tasks" v-loading="loading" style="width: 100%">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户" width="150" />
      <el-table-column prop="channelUsed" label="渠道" width="120" />
      <el-table-column prop="presetUsed" label="预设" width="120">
        <template #default="{ row }">
          {{ row.presetUsed || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="userInput" label="用户输入" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="duration" label="耗时" width="100">
        <template #default="{ row }">
          {{ row.duration ? row.duration + 'ms' : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button size="small" @click="viewDetail(row)">查看</el-button>
          <el-button size="small" type="danger" @click="deleteTask(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="currentPage"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="loadTasks"
      style="margin-top: 20px; justify-content: center"
    />

    <!-- 详情对话框 -->
    <el-dialog v-model="showDetail" title="任务详情" width="800px">
      <el-descriptions v-if="selectedTask" :column="2" border>
        <el-descriptions-item label="任务ID">{{ selectedTask.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedTask.status)">
            {{ getStatusText(selectedTask.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="用户">{{ selectedTask.username }}</el-descriptions-item>
        <el-descriptions-item label="渠道">{{ selectedTask.channelUsed }}</el-descriptions-item>
        <el-descriptions-item label="预设">{{ selectedTask.presetUsed || '-' }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{ selectedTask.duration }}ms</el-descriptions-item>
        <el-descriptions-item label="用户输入" :span="2">
          {{ selectedTask.userInput }}
        </el-descriptions-item>
        <el-descriptions-item label="最终Prompt" :span="2">
          <pre style="white-space: pre-wrap; margin: 0">{{ selectedTask.finalPrompt }}</pre>
        </el-descriptions-item>
        <el-descriptions-item v-if="selectedTask.error" label="错误信息" :span="2">
          <el-alert type="error" :closable="false">{{ selectedTask.error }}</el-alert>
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="selectedTask && selectedTask.outputImages" style="margin-top: 20px">
        <h4>生成的图片：</h4>
        <div class="image-grid">
          <div v-for="(img, index) in parseImages(selectedTask.outputImages)" :key="index" class="image-item">
            <img :src="img" alt="Generated Image" />
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { send, message } from '@koishijs/client'

interface Task {
  id: number
  userId: string
  username: string
  channelUsed: string
  presetUsed: string
  userInput: string
  finalPrompt: string
  outputImages: string
  status: string
  error: string
  duration: number
  startTime: Date
}

const tasks = ref<Task[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const showDetail = ref(false)
const selectedTask = ref<Task | null>(null)

// 加载任务列表
async function loadTasks() {
  loading.value = true
  try {
    const result: any = await send('banana/tasks/list', {
      page: currentPage.value,
      limit: pageSize.value
    })
    
    if (result.success) {
      tasks.value = result.data.tasks
      total.value = result.data.total
    } else {
      message.error('加载任务失败: ' + result.error)
    }
  } catch (error: any) {
    message.error('加载任务失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 查看详情
function viewDetail(task: Task) {
  selectedTask.value = task
  showDetail.value = true
}

// 删除任务
async function deleteTask(task: Task) {
  if (!confirm(`确定要删除任务 #${task.id} 吗？`)) return
  
  try {
    const result: any = await send('banana/tasks/delete', { id: task.id })
    if (result.success) {
      message.success('删除成功')
      await loadTasks()
    } else {
      message.error('删除失败: ' + result.error)
    }
  } catch (error: any) {
    message.error('删除失败: ' + error.message)
  }
}

// 获取状态类型
function getStatusType(status: string) {
  const types: Record<string, string> = {
    success: 'success',
    failed: 'danger',
    processing: 'warning',
    pending: 'info'
  }
  return types[status] || 'info'
}

// 获取状态文本
function getStatusText(status: string) {
  const texts: Record<string, string> = {
    success: '成功',
    failed: '失败',
    processing: '处理中',
    pending: '等待中'
  }
  return texts[status] || status
}

// 解析图片JSON
function parseImages(imagesJson: string): string[] {
  try {
    return JSON.parse(imagesJson || '[]')
  } catch {
    return []
  }
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.task-center {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.image-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.image-item img {
  width: 100%;
  height: auto;
  display: block;
}
</style>
