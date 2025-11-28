<template>
  <div class="tech-container">
    <div class="tech-header">
      <div>
        <h2 class="tech-title"><el-icon><TrendCharts /></el-icon> 数据看板</h2>
        <p class="tech-subtitle">生成任务与用户活跃度分析</p>
      </div>
    </div>

    <div class="stats-overview">
      <div class="tech-card stat-box">
        <div class="label">今日生成</div>
        <div class="value">{{ stats.todayCount }}</div>
      </div>
      <div class="tech-card stat-box">
        <div class="label">本周生成</div>
        <div class="value">{{ stats.weekCount }}</div>
      </div>
      <div class="tech-card stat-box">
        <div class="label">总计生成</div>
        <div class="value">{{ stats.totalCount }}</div>
      </div>
      <div class="tech-card stat-box">
        <div class="label">成功率</div>
        <div class="value highlight">{{ stats.successRate }}%</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="tech-card chart-panel">
        <h3 class="panel-title">热门提示词 TOP 10</h3>
        <el-table :data="stats.topPrompts" style="width: 100%">
          <el-table-column prop="name" label="提示词" />
          <el-table-column prop="count" label="次数" width="100" align="right" />
        </el-table>
      </div>

      <div class="tech-card chart-panel">
        <h3 class="panel-title">活跃用户 TOP 10</h3>
        <el-table :data="stats.topUsers" style="width: 100%">
          <el-table-column prop="user" label="用户" />
          <el-table-column prop="count" label="次数" width="100" align="right" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { send } from '@koishijs/client'
import { TrendCharts } from '@element-plus/icons-vue'

type Stats = { todayCount: number; weekCount: number; totalCount: number; successRate: number; topPrompts: any[]; topUsers: any[] }
const stats = ref<Stats>({
  todayCount: 0,
  weekCount: 0,
  totalCount: 0,
  successRate: 0,
  topPrompts: [],
  topUsers: []
})

onMounted(async () => {
  const res: any = await send('banana/tasks/list', { page: 1, limit: 500 })
  const tasks = res?.data?.tasks || []
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - 7)
  const total = tasks.length
  const success = tasks.filter((t: any) => t.status === 'success').length
  const todayCount = tasks.filter((t: any) => new Date(t.startTime) >= startOfToday).length
  const weekCount = tasks.filter((t: any) => new Date(t.startTime) >= startOfWeek).length

  const promptCount: Record<string, number> = {}
  const userCount: Record<string, number> = {}
  tasks.forEach((t: any) => {
    const k = (t.presetUsed || t.channelUsed || '').trim()
    if (k) promptCount[k] = (promptCount[k] || 0) + 1
    const u = (t.username || '').trim()
    if (u) userCount[u] = (userCount[u] || 0) + 1
  })
  const topPrompts = Object.entries(promptCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({ name, count }))
  const topUsers = Object.entries(userCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([user,count])=>({ user, count }))

  stats.value = {
    todayCount,
    weekCount,
    totalCount: total,
    successRate: total ? Math.round((success / total) * 100) : 0,
    topPrompts,
    topUsers,
  }
})
</script>
