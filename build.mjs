import { build } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import vue from '@vitejs/plugin-vue'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function buildClient() {
  console.log('🔨 开始构建前端...')
  
  await build({
    root: resolve(__dirname, 'client'),
    base: '/dist/',
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,
      lib: {
        entry: resolve(__dirname, 'client/index.ts'),
        formats: ['es'],
        fileName: 'index'
      },
      rollupOptions: {
        external: [
          'vue',
          '@koishijs/client',
          'element-plus'
        ]
      }
    },
    plugins: [vue()]
  })
  
  console.log('✅ 前端构建完成！')
}

buildClient().catch(console.error)
