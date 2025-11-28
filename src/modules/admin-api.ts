// 模块 3：管理 API 模块（使用服务层）
import { Context, Logger } from 'koishi'
import { BananaChannel, BananaPreset } from '../database'
import { BananaServices, GenerateImageRequest } from '../services'
import { CommandRegistry } from './command-registry'

export class AdminAPI {
  constructor(
    private ctx: Context,
    private logger: Logger,
    private services: BananaServices,
    private config: any,
    private commandRegistry?: CommandRegistry
  ) {}
  
  /**
   * 注册所有 API 端点
   */
  register() {
    this.registerChannelAPI()
    this.registerPresetAPI()
    this.registerTaskAPI()
    this.registerGenerateAPI()
    this.registerApiPresetAPI()
    this.registerChatLunaAPI()
  }
  
  /**
   * 渠道管理 API
   */
  private registerChannelAPI() {
    const console = this.ctx.console as any
    
    // 获取渠道列表
    console.addListener('banana/channels/list', async () => {
      try {
        const channels = await this.services.channel.getAll()
        return { success: true, data: channels }
      } catch (error) {
        this.logger.error('获取渠道列表失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 创建渠道
    console.addListener('banana/channels/create', async (data: Partial<BananaChannel>) => {
      try {
        const channel = await this.services.channel.create(data)
        
        // 重新加载指令
        if (this.commandRegistry) {
          await this.commandRegistry.reloadCommands()
        }
        
        this.logger.info(`创建渠道成功: ${channel.name}`)
        return { success: true, data: channel }
      } catch (error) {
        this.logger.error('创建渠道失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 更新渠道
    console.addListener('banana/channels/update', async ({ id, data }: { id: number, data: Partial<BananaChannel> }) => {
      try {
        await this.services.channel.update(id, data)
        
        // 重新加载指令
        if (this.commandRegistry) {
          await this.commandRegistry.reloadCommands()
        }
        
        this.logger.info(`更新渠道成功: ID ${id}`)
        return { success: true }
      } catch (error) {
        this.logger.error('更新渠道失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 删除渠道
    console.addListener('banana/channels/delete', async ({ id }: { id: number }) => {
      try {
        await this.services.channel.delete(id)
        
        // 重新加载指令
        if (this.commandRegistry) {
          await this.commandRegistry.reloadCommands()
        }
        
        this.logger.info(`删除渠道成功: ID ${id}`)
        return { success: true }
      } catch (error) {
        this.logger.error('删除渠道失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 切换渠道启用状态
    console.addListener('banana/channels/toggle', async ({ id, enabled }: { id: number, enabled: boolean }) => {
      try {
        await this.services.channel.toggle(id, enabled)
        
        // 重新加载指令
        if (this.commandRegistry) {
          await this.commandRegistry.reloadCommands()
        }
        
        this.logger.info(`切换渠道状态: ID ${id}, enabled=${enabled}`)
        return { success: true }
      } catch (error) {
        this.logger.error('切换渠道状态失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
  
  /**
   * 预设管理 API（统一处理 API 预设和用户预设）
   */
  private registerPresetAPI() {
    const console = this.ctx.console as any
    
    // 获取预设列表（包含 API 预设和用户预设）
    console.addListener('banana/presets/list', async () => {
      try {
        const presets = await this.services.preset.getAll()
        return { success: true, data: presets }
      } catch (error) {
        this.logger.error('获取预设列表失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 创建预设
    console.addListener('banana/presets/create', async (data: Partial<BananaPreset>) => {
      try {
        const preset = await this.services.preset.create({
          ...data,
          source: 'user' // 新创建的都是用户预设
        })
        this.logger.info(`创建预设成功: ${preset.name}`)
        return { success: true, data: preset }
      } catch (error) {
        this.logger.error('创建预设失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 更新预设（编辑 API 预设时自动转为用户预设）
    console.addListener('banana/presets/update', async ({ id, data }: { id: number, data: Partial<BananaPreset> }) => {
      try {
        const preset = await this.services.preset.getById(id)
        
        // 如果是 API 预设，编辑时自动转为用户预设
        if (preset && preset.source === 'api') {
          await this.services.preset.update(id, {
            ...data,
            source: 'user'
          })
          this.logger.info(`API 预设转为用户预设: ${preset.name}`)
        } else {
          await this.services.preset.update(id, data)
        }
        
        this.logger.info(`更新预设成功: ID ${id}`)
        return { success: true }
      } catch (error) {
        this.logger.error('更新预设失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 删除预设
    console.addListener('banana/presets/delete', async ({ id }: { id: number }) => {
      try {
        await this.services.preset.delete(id)
        this.logger.info(`删除预设成功: ID ${id}`)
        return { success: true }
      } catch (error) {
        this.logger.error('删除预设失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 切换预设启用状态
    console.addListener('banana/presets/toggle', async ({ id, enabled }: { id: number, enabled: boolean }) => {
      try {
        await this.services.preset.toggle(id, enabled)
        this.logger.info(`切换预设状态成功: ID ${id}, enabled: ${enabled}`)
        return { success: true }
      } catch (error) {
        this.logger.error('切换预设状态失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 复制预设（自动重命名）
    console.addListener('banana/presets/copy', async ({ id }: { id: number }) => {
      try {
        const original = await this.services.preset.getById(id)
        if (!original) {
          throw new Error('预设不存在')
        }
        
        // 自动生成新名称
        const allPresets = await this.services.preset.getAll()
        let newName = `${original.name} - 副本`
        let counter = 1
        
        while (allPresets.some(p => p.name === newName)) {
          newName = `${original.name} - 副本 (${counter})`
          counter++
        }
        
        const newPreset = await this.services.preset.create({
          name: newName,
          prompt: original.prompt,
          source: 'user', // 复制后都是用户预设
          enabled: true
        })
        
        this.logger.info(`复制预设成功: ${original.name} -> ${newName}`)
        return { success: true, data: newPreset }
      } catch (error) {
        this.logger.error('复制预设失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
  
  /**
   * 任务查询 API
   */
  private registerTaskAPI() {
    const console = this.ctx.console as any
    
    // 获取任务列表（分页）
    console.addListener('banana/tasks/list', async (options: any = {}) => {
      try {
        const result = await this.services.task.getTasks(options)
        return { success: true, data: result }
      } catch (error) {
        this.logger.error('获取任务列表失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 获取任务详情
    console.addListener('banana/tasks/detail', async ({ id }: { id: number }) => {
      try {
        const task = await this.services.task.getTaskById(id)
        if (!task) {
          return { success: false, error: '任务不存在' }
        }
        return { success: true, data: task }
      } catch (error) {
        this.logger.error('获取任务详情失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 删除任务
    console.addListener('banana/tasks/delete', async ({ id }: { id: number }) => {
      try {
        await this.services.task.deleteTask(id)
        this.logger.info(`删除任务成功: ID ${id}`)
        return { success: true }
      } catch (error) {
        this.logger.error('删除任务失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
  
  /**
   * 画图生成 API（核心功能）
   */
  private registerGenerateAPI() {
    const console = this.ctx.console as any
    
    // WebUI 画图接口
    console.addListener('banana/generate', async (request: GenerateImageRequest) => {
      try {
        // 使用配置的 WebUI 用户 ID
        const webuiRequest = {
          ...request,
          userId: this.config.webuiUserId || request.userId
        }
        
        this.logger.info('WebUI 画图请求:', {
          channelId: webuiRequest.channelId,
          presetId: webuiRequest.presetId,
          userId: webuiRequest.userId,
          userInput: webuiRequest.userInput
        })
        
        const result = await this.services.task.generateImage(webuiRequest)
        
        if (result.success) {
          this.logger.info(`画图成功: 任务ID ${result.taskId}, 耗时 ${result.duration}ms`)
        } else {
          this.logger.error(`画图失败: ${result.error}`)
        }
        
        return { success: result.success, data: result }
      } catch (error) {
        this.logger.error('画图请求失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
  
  /**
   * API 预设管理 API
   */
  private registerApiPresetAPI() {
    const console = this.ctx.console as any
    
    // 手动同步 API 预设
    console.addListener('banana/api-presets/sync', async () => {
      try {
        this.logger.info('收到手动同步 API 预设请求')
        const count = await this.services.apiPreset.syncPresetsToDatabase()
        return { success: true, data: { count } }
      } catch (error) {
        this.logger.error('同步 API 预设失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 获取 API 预设列表（不同步，只查询）
    console.addListener('banana/api-presets/list', async () => {
      try {
        const presets = await this.services.apiPreset.fetchPresetsFromAPI()
        return { success: true, data: presets }
      } catch (error) {
        this.logger.error('获取 API 预设失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 保存 API 预设状态
    console.addListener('banana-pro/save-api-prompts', async (prompts: Array<{ name: string, prompt: string, enabled: boolean }>) => {
      try {
        this.logger.info(`保存 API 预设状态`)
        
        // 更新 API 预设的启用状态
        for (const prompt of prompts) {
          await this.services.apiPreset.updateEnabled(prompt.name, prompt.enabled)
        }
        
        return { success: true }
      } catch (error) {
        this.logger.error('保存 API 预设状态失败:', error)
        return { success: false, error: error.message }
      }
    })
    
    // 复制 API 预设到用户预设
    console.addListener('banana/api-presets/copy', async ({ name, prompt }: { name: string, prompt: string }) => {
      try {
        this.logger.info(`复制 API 预设到用户预设: ${name}`)
        
        // 检查名称是否已存在
        const existing = await this.services.preset.getAll()
        let finalName = name
        let counter = 1
        
        while (existing.some(p => p.name === finalName)) {
          finalName = `${name} (${counter})`
          counter++
        }
        
        const preset = await this.services.preset.create({
          name: finalName,
          prompt,
          source: 'user',
          enabled: true
        })
        
        this.logger.info(`复制成功: ${finalName}`)
        return { success: true, data: preset }
      } catch (error) {
        this.logger.error('复制 API 预设失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
  
  /**
   * ChatLuna API
   */
  private registerChatLunaAPI() {
    const console = this.ctx.console as any
    
    // 获取所有可用的 ChatLuna 模型
    console.addListener('banana/chatluna/models', async () => {
      try {
        if (!this.ctx.chatluna) {
          this.logger.warn('[ChatLuna] 服务未启用')
          return { success: false, error: 'ChatLuna 未启用' }
        }
        
        const models: Array<{ value: string, label: string }> = []
        
        try {
          // 使用 listAllModels 方法获取所有 LLM 模型
          // ModelType.llm = 1 (llm 类型)
          const allModelsRef = this.ctx.chatluna.platform.listAllModels(1)
          const allModels = allModelsRef.value
          
          this.logger.info(`[ChatLuna] 找到 ${allModels.length} 个模型`)
          
          for (const model of allModels) {
            const fullName = model.toModelName()
            models.push({
              value: fullName,
              label: fullName
            })
          }
        } catch (err) {
          this.logger.error('[ChatLuna] 获取模型时出错:', err)
        }
        
        this.logger.info(`[ChatLuna] 最终返回 ${models.length} 个模型`)
        return { success: true, data: models }
      } catch (error) {
        this.logger.error('[ChatLuna] API 调用失败:', error)
        return { success: false, error: error.message }
      }
    })
  }
}
