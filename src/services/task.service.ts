import { Context, Logger } from 'koishi'
import { BananaChannel, BananaPreset, BananaTask } from '../database'
import { callDalleApi } from '../api/dalle'
import { callChatLunaApi } from '../api/chatluna'
import { FileData } from '../types'

export interface GenerateImageRequest {
  channelId: number
  presetId?: number
  userInput: string
  inputImages?: Array<{ data: string | ArrayBuffer, mime: string, filename: string }>
  userId?: string
  username?: string
  channelId_?: string
  guildId?: string
}

export interface GenerateImageResult {
  taskId: number
  success: boolean
  outputImages?: string[]
  error?: string
  duration?: number
  cost?: number
  currency?: string
  channelName?: string
  balanceBefore?: number
  balanceAfter?: number
  charged?: boolean
}

export class TaskService {
  constructor(
    private ctx: Context,
    private logger: Logger,
  ) {}

  async generateImage(request: GenerateImageRequest): Promise<GenerateImageResult> {
    let taskId: number
    let charged = false
    let channel: BananaChannel
    const start = Date.now()
    try {
      this.logger.info(`[generate] user=${request.userId || 'webui'} channelId=${request.channelId}`)
      channel = await this.getChannel(request.channelId)
      if (!channel) throw new Error(`channel not found: ${request.channelId}`)
      if (!channel.enabled) throw new Error(`channel disabled: ${channel.name}`)
      this.logger.info(`[channel] name=${channel.name} cost=${channel.cost} ${channel.currency}`)

      let balanceBefore = 0
      if (channel.cost > 0 && request.userId && this.ctx.monetary) {
        try {
          balanceBefore = await (this.ctx.monetary as any).get?.(request.userId, channel.currency)
            ?? await (this.ctx.monetary as any).getBalance?.(request.userId, channel.currency)
            ?? 0
          if (balanceBefore < channel.cost) throw new Error(`INSUFFICIENT_BALANCE:${balanceBefore}`)
        } catch (e: any) {
          if (String(e?.message || '').startsWith('INSUFFICIENT_BALANCE:')) throw e
          this.logger.warn(`[monetary] balance check failed: ${e?.message || e}`)
        }
      }

      let preset: BananaPreset | null = null
      if (request.presetId) {
        preset = await this.getPreset(request.presetId)
        if (!preset) throw new Error(`preset not found: ${request.presetId}`)
        this.logger.info(`[preset] name=${preset.name}`)
      }

      const finalPrompt = this.buildPrompt(preset, request.userInput)
      if (!finalPrompt) throw new Error('prompt build failed, please check preset')
      this.logger.info(`[prompt] length=${finalPrompt.length}`)

      if (channel.cost > 0 && request.userId && this.ctx.monetary) {
        try {
          await this.ctx.monetary.cost(request.userId, channel.cost, channel.currency)
          charged = true
        } catch (e: any) {
          throw new Error(`insufficient balance: need ${channel.cost} ${channel.currency}`)
        }
      }

      taskId = await this.createTask(channel, preset, request, finalPrompt)

      const converted: FileData[] = (request.inputImages || []).map((img) => {
        if (typeof img.data === 'string') {
          const buf = Buffer.from(img.data, 'base64')
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
          return { data: ab, mime: img.mime, filename: img.filename }
        }
        return img as any
      })

      this.logger.info(`[api] calling ${channel.apiMode}`)
      const result = await this.callAPI(channel, finalPrompt, converted)
      const duration = Date.now() - start

      const outputImages = Array.isArray(result) ? result : [result]
      await this.updateTaskSuccess(taskId, outputImages, duration)

      let balanceAfter = balanceBefore
      if (charged && request.userId && this.ctx.monetary) {
        try {
          balanceAfter = await (this.ctx.monetary as any).get?.(request.userId, channel.currency)
            ?? await (this.ctx.monetary as any).getBalance?.(request.userId, channel.currency)
            ?? 0
        } catch (e) { this.logger.warn(`[monetary] get after failed: ${e}`) }
      }

      return { taskId, success: true, outputImages, duration, cost: channel.cost, currency: channel.currency, channelName: channel.name, balanceBefore, balanceAfter, charged }
    } catch (error: any) {
      const duration = Date.now() - start
      this.logger.error(`[task failed] id=${taskId || 'N/A'} reason=${error?.message || error}`)
      if (charged && request.userId && this.ctx.monetary) {
        try {
          const ch = await this.getChannel(request.channelId)
          await this.ctx.monetary.gain(request.userId, ch.cost, ch.currency)
          if (taskId) await this.updateTaskFailed(taskId, error?.message || String(error), true)
        } catch {
          if (taskId) await this.updateTaskFailed(taskId, error?.message || String(error), false)
        }
      } else {
        if (taskId) await this.updateTaskFailed(taskId, error?.message || String(error), false)
      }
      return { taskId: taskId as number, success: false, error: error?.message || String(error), duration }
    }
  }

  async getTasks(options: { page?: number; limit?: number; status?: string; userId?: string } = {}) {
    const { page = 1, limit = 20, status, userId } = options
    const where: any = {}
    if (status) where.status = status
    if (userId) where.userId = userId
    const tasks = await this.ctx.database.select('banana_task').where(where).orderBy('startTime', 'desc').limit(limit).offset((page - 1) * limit).execute()
    const total = (await this.ctx.database.select('banana_task').where(where).execute()).length
    return { tasks, total, page, totalPages: Math.ceil(total / limit) }
  }

  async getTaskById(id: number): Promise<BananaTask | null> { const rows = await this.ctx.database.get('banana_task', { id }); return rows[0] || null }
  async deleteTask(id: number) { await this.ctx.database.remove('banana_task', id) }

  private async getChannel(id: number): Promise<BananaChannel> { const rows = await this.ctx.database.get('banana_channel', { id }); return rows[0] as any }
  private async getPreset(id: number): Promise<BananaPreset | null> { const rows = await this.ctx.database.get('banana_preset', { id }); return rows[0] || null }

  private buildPrompt(preset: BananaPreset | null, userInput: string): string {
    if (!preset) return userInput || ''
    if (preset.prompt.includes('{{userText}}')) return preset.prompt.replace(/\{\{userText\}\}/g, userInput || '')
    return userInput ? `${preset.prompt}\n${userInput}` : preset.prompt
  }

  private async createTask(channel: BananaChannel, preset: BananaPreset | null, req: GenerateImageRequest, finalPrompt: string): Promise<number> {
    const task = await this.ctx.database.create('banana_task', {
      userId: req.userId || 'webui',
      username: req.username || 'WebUI',
      channelId: req.channelId_ || '',
      guildId: req.guildId || '',
      channelUsed: channel.name,
      channelIdFk: channel.id,
      presetUsed: preset?.name || '',
      presetIdFk: preset?.id || 0,
      userInput: req.userInput,
      finalPrompt,
      inputImages: JSON.stringify((req.inputImages || []).map(x => x.filename)),
      outputImages: '',
      status: 'processing',
      error: '',
      cost: channel.cost,
      currency: channel.currency,
      refunded: false,
      startTime: new Date(),
      endTime: null,
      duration: 0,
    })
    return (task as any).id
  }

  private async updateTaskSuccess(taskId: number, outputImages: string[], duration: number) {
    await this.ctx.database.set('banana_task', taskId, { status: 'success', outputImages: JSON.stringify(outputImages), endTime: new Date(), duration })
  }
  private async updateTaskFailed(taskId: number, error: string, refunded: boolean) {
    await this.ctx.database.set('banana_task', taskId, { status: 'failed', error, refunded, endTime: new Date() })
  }

  private async callAPI(channel: BananaChannel, prompt: string, images: FileData[]): Promise<any> {
    if (channel.apiMode === 'dalle') {
      const resolvedModel = channel.model || 'nano-banana'
      const apiParams: Record<string, any> = { prompt: '{{prompt}}', model: resolvedModel }
      if (channel.n) apiParams.n = String(channel.n)
      if (channel.size) apiParams.size = channel.size
      if (channel.quality) apiParams.quality = channel.quality
      if (channel.style) apiParams.style = channel.style
      if (images && images.length > 0) apiParams.image = '{{inputimage}}'
      this.logger.info(`[api-params] mode=dalle model=${resolvedModel} n=${apiParams.n || 1} size=${apiParams.size || '-'} quality=${apiParams.quality || '-'} style=${apiParams.style || '-'}`)
      return await callDalleApi(this.ctx, this.logger, { apiUrl: channel.apiUrl, apiKey: channel.apiKey, apiParams, loggerinfo: true }, images, prompt)
    }
    if (channel.apiMode === 'chatluna') {
      const resolved = (channel as any).chatlunaModel || channel.model || 'openai/gpt-4-vision-preview'
      this.logger.info(`[api-params] mode=chatluna model=${resolved}`)
      return await callChatLunaApi(this.ctx, this.logger, { model: resolved, chatMode: 'chat' }, images, prompt)
    }
    throw new Error(`unknown apiMode: ${channel.apiMode}`)
  }
}

