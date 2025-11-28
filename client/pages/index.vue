<template>
  <k-layout class="app-layout banana-pro-app">
    <div class="top-nav">
      <div class="nav-container">
        <div class="logo-area"><span class="logo-text">BANANA PRO</span></div>
        <div class="nav-tabs" role="tablist">
          <div
            v-for="item in menuItems"
            :key="item.id"
            class="nav-tab"
            :class="{ active: currentView === item.id }"
            @click="currentView = item.id"
            role="tab"
            :aria-selected="currentView === item.id"
          >
            <el-icon class="tab-icon"><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <component :is="currentComponent" />
    </div>
  </k-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Brush, Picture, TrendCharts, Setting } from '@element-plus/icons-vue'
import GeneratePage from './generate.vue'
import GalleryView from './gallery-view.vue'
import StatsPanel from './stats-panel.vue'
import Configuration from './configuration.vue'
import PresetManager from './preset-manager.vue'
import '../styles/theme.css'

const currentView = ref('generate')
const menuItems = [
  { id: 'generate', label: '绘图', icon: Brush },
  { id: 'gallery', label: '画廊', icon: Picture },
  { id: 'stats', label: '数据', icon: TrendCharts },
  { id: 'preset', label: '预设', icon: Setting },
  { id: 'config', label: '配置', icon: Setting },
]

const currentComponent = computed(() => {
  switch (currentView.value) {
    case 'generate': return GeneratePage
    case 'gallery': return GalleryView
    case 'stats': return StatsPanel
    case 'preset': return PresetManager
    case 'config': return Configuration
    default: return GeneratePage
  }
})

// 隐藏 Koishi 顶部 header，只在本页面生效
let prevHeaderDisplay = ''
function hideHeader() {
  const el = document.querySelector('.layout-header') as HTMLElement
  if (el) { prevHeaderDisplay = el.style.display; el.style.display = 'none' }
}
function restoreHeader() {
  const el = document.querySelector('.layout-header') as HTMLElement
  if (el) el.style.display = prevHeaderDisplay || ''
}
onMounted(hideHeader)
onBeforeUnmount(restoreHeader)
</script>

<style scoped>
.app-layout { background: #fff; height: 100vh; min-height: 0; }
.top-nav { position: sticky; top: 0; z-index: 10; background: var(--tech-bg-surface); border-bottom: 1px solid var(--tech-border); height: 56px; }
.nav-container { max-width: 1200px; margin: 0 auto; padding: 0 20px; height: 56px; display: flex; align-items: center; gap: 24px; }
.nav-tabs { display: flex; gap: 16px; margin-left: auto; }
.nav-tab { display: inline-flex; align-items: center; gap: 8px; padding: 10px 4px; cursor: pointer; color: var(--tech-text-secondary); border-bottom: 2px solid transparent; transition: color .15s ease, border-color .15s ease; }
.nav-tab:hover { color: var(--tech-text-primary); }
.nav-tab.active { color: var(--tech-primary); border-bottom-color: var(--tech-primary); font-weight: 600; }
.tab-icon { display: inline-flex; font-size: 14px; }
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  height: calc(100vh - 56px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;           /* Firefox */
  -ms-overflow-style: none;        /* IE/Edge */
}
.main-content::-webkit-scrollbar { /* WebKit */
  width: 0;
  height: 0;
}
.logo-area .logo-text { font-weight: 600; letter-spacing: .5px; color: var(--tech-text-primary); }

/* 隐藏控制台的默认页头空白 */
.app-layout :deep(.k-header),
.app-layout :deep(.k-view-header),
.app-layout :deep(.k-page-header),
.app-layout :deep(.k-toolbar) { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; }
</style>
