import { Context, Logger } from 'koishi'
import { PresetService } from './preset.service'

export interface ApiPreset {
  title: string
  prompt: string
}

export interface ApiPresetResponse {
  current_page: number
  data: ApiPreset[]
}

/**
 * API 预设服务 - 从外部 API 获取预设并同步到数据库
 */
export class ApiPresetService {
  constructor(
    private ctx: Context,
    private logger: Logger,
    private presetService: PresetService,
    private config: any
  ) {}

  /**
   * 从 API 获取预设列表
   */
  async fetchPresetsFromAPI(): Promise<ApiPreset[]> {
    if (!this.config.enableApiPrompts) {
      this.logger.info('[API预设] 已禁用，跳过获取')
      return []
    }

    const apiUrl = this.config.promptApiUrl
    if (!apiUrl) {
      this.logger.warn('[API预设] 未配置 API URL')
      return []
    }

    try {
      this.logger.info(`[API预设] 开始获取: ${apiUrl}`)
      const response = await this.ctx.http.get<ApiPresetResponse>(apiUrl)
      
      if (!response || !Array.isArray(response.data)) {
        this.logger.error('[API预设] API 返回数据格式错误，应为 { data: [...] }')
        return []
      }

      this.logger.info(`[API预设] 获取成功，共 ${response.data.length} 个预设`)
      return response.data
    } catch (error) {
      this.logger.error(`[API预设] 获取失败: ${error.message}`)
      return []
    }
  }

  /**
   * 同步 API 预设到数据库
   * 策略：UPSERT - 更新现有预设，插入新预设，删除过时预设（保持 ID 稳定）
   */
  async syncPresetsToDatabase(): Promise<number> {
    const apiPresets = await this.fetchPresetsFromAPI()
    if (apiPresets.length === 0) {
      this.logger.info('[API预设] 没有可同步的预设')
      return 0
    }

    try {
      // 1. 获取现有的 API 预设
      const existingPresets = await this.ctx.database
        .select('banana_preset')
        .where({ source: 'api' })
        .execute()
      
      const existingMap = new Map(existingPresets.map(p => [p.name, p]))
      const apiPresetNames = new Set(apiPresets.map(p => p.title))
      
      // 2. 删除不再存在的 API 预设
      const toDelete = existingPresets.filter(p => !apiPresetNames.has(p.name))
      if (toDelete.length > 0) {
        for (const preset of toDelete) {
          await this.ctx.database.remove('banana_preset', { id: preset.id })
        }
        this.logger.info(`[API预设] 删除过时预设 ${toDelete.length} 个`)
      }
      
      // 3. 更新或插入预设（保持 ID 不变）
      let updateCount = 0
      let createCount = 0
      
      for (const preset of apiPresets) {
        try {
          const existing = existingMap.get(preset.title)
          
          if (existing) {
            // 只有 prompt 变化时才更新
            if (existing.prompt !== preset.prompt) {
              await this.ctx.database.set('banana_preset', existing.id, {
                prompt: preset.prompt
              })
              this.logger.info(`[API预设] 更新预设: ${preset.title} (ID: ${existing.id})`)
              updateCount++
            } else {
              this.logger.debug(`[API预设] 预设未变化，跳过: ${preset.title}`)
            }
          } else {
            // 创建新预设
            const newPreset = await this.presetService.create({
              name: preset.title,
              prompt: preset.prompt,
              source: 'api',
              enabled: true
            })
            this.logger.info(`[API预设] 新增预设: ${preset.title} (ID: ${newPreset.id})`)
            createCount++
          }
        } catch (error) {
          this.logger.warn(`[API预设] 处理预设失败: ${preset.title}, 原因: ${error.message}`)
        }
      }

      this.logger.info(`[API预设] 同步完成，更新 ${updateCount} 个，新增 ${createCount} 个`)
      return updateCount + createCount
    } catch (error) {
      this.logger.error(`[API预设] 同步失败: ${error.message}`)
      return 0
    }
  }

  /**
   * 更新 API 预设的启用状态
   */
  async updateEnabled(name: string, enabled: boolean): Promise<void> {
    try {
      const preset = await this.ctx.database
        .select('banana_preset')
        .where({ name, source: 'api' })
        .execute()
      
      if (preset.length > 0) {
        await this.ctx.database.set('banana_preset', preset[0].id, { enabled })
        this.logger.info(`[API预设] 更新状态: ${name} -> ${enabled}`)
      }
    } catch (error) {
      this.logger.error(`[API预设] 更新状态失败: ${name}, ${error.message}`)
      throw error
    }
  }

  /**
   * 启动定时同步任务
   */
  startAutoSync() {
    if (!this.config.enableApiPrompts || !this.config.autoRefreshInterval) {
      this.logger.info('[API预设] 自动同步已禁用')
      return
    }

    const intervalMs = this.config.autoRefreshInterval * 1000
    this.logger.info(`[API预设] 启动自动同步，间隔: ${this.config.autoRefreshInterval}秒`)

    // 立即执行一次
    this.syncPresetsToDatabase()

    // 定时执行
    this.ctx.setInterval(() => {
      this.syncPresetsToDatabase()
    }, intervalMs)
  }
}
