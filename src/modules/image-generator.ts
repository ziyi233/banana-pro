import { Context, Session, h, Logger } from 'koishi'
import type {} from 'koishi-plugin-nailong-monetary'
import { BananaChannel, BananaPreset } from '../database'
import { extractImagesFromSession } from '../utils/image'
import { BananaServices } from '../services'
import { FileData } from '../types'
import { Config } from '../config'

export class ImageGenerator {
  constructor(
    private ctx: Context,
    private logger: Logger,
    private services: BananaServices,
    private config: Config,
  ) {}

  // 统一交互收集流程
  async handleInteractive(
    session: Session,
    channel: BananaChannel,
    preset: BananaPreset | null,
    userInput: string,
    maxImages: number = 3,
    collectedText: string = '',
    collectedImages: FileData[] = [],
  ) {
    const currentImages = await this.extractImages(session, maxImages)
    const currentText = (userInput || '').trim()

    const allText = [collectedText, currentText].filter(Boolean).join(' ')
    const allImages = [...collectedImages, ...currentImages].slice(0, maxImages)

    this.logger.info(`[交互收集] 预设: ${preset?.name || '无'}, 当前文本: "${currentText}", 当前图片: ${currentImages.length}, 累计文本: "${allText}", 累计图片: ${allImages.length}`)

    const isFirstCall = !collectedText && collectedImages.length === 0
    if (isFirstCall && currentImages.length > 0) {
      this.logger.info(`[直接生成] 第一次调用且有图片，直接生成`)
      return await this.handle(session, channel, preset, allText, maxImages, allImages)
    }

    const trimmed = currentText.toLowerCase()
    if (trimmed === '开始' || trimmed === 'start') {
      if (!allText && allImages.length === 0) return '未收集到任何内容，请先发送图片或文字描述'
      this.logger.info(`[交互确认] 用户确认开始生成`)
      return await this.handle(session, channel, preset, allText, maxImages, allImages)
    }
    if (trimmed === '取消' || trimmed === 'cancel') {
      this.logger.info(`[交互取消] 用户取消生成`)
      return '已取消生成'
    }

    const tips: string[] = []
    if (allText || allImages.length > 0) {
      tips.push('📝 已收集内容：')
      if (allText) tips.push(`  文本：${allText}`)
      if (allImages.length > 0) tips.push(`  图片：${allImages.length} 张`)
      tips.push('')
    }
    tips.push('💡 继续发送图片或文字，或者：')
    tips.push('  • 发送「开始」立即生成')
    tips.push('  • 发送「取消」取消生成')
    tips.push('  • 60 秒内有效')
    await session.send(tips.join('\n'))

    return new Promise((resolve) => {
      const dispose = this.ctx.middleware(async (nextSession, next) => {
        if (nextSession.userId === session.userId && nextSession.channelId === session.channelId && nextSession.guildId === session.guildId) {
          dispose()
          clearTimeout(timer)
          this.logger.info(`[交互收集] 收到用户新消息`)
          const result = await this.handleInteractive(nextSession, channel, preset, nextSession.content, maxImages, allText, allImages)
          resolve(result)
        }
        return next()
      })
      const timer = setTimeout(() => { dispose(); resolve('⏱️ 等待超时，已自动取消') }, 60000)
    })
  }

  // 处理画图请求（主流程）
  async handle(
    session: Session,
    channel: BananaChannel,
    preset: BananaPreset | null,
    userInput: string,
    maxImages: number = 3,
    providedImages: FileData[] = [],
  ) {
    const quote = h.quote(session.messageId)
    // 开始处理提示
    try { if (this.config.showStartMessage) await session.send(this.config.startMessageTemplate) } catch {}

    try {
      const images = providedImages.length > 0 ? providedImages : await this.extractImages(session, maxImages)
      const inputImages = images.map(img => ({ data: Buffer.from(img.data).toString('base64'), mime: img.mime, filename: img.filename }))

      const result = await this.services.task.generateImage({
        channelId: channel.id,
        presetId: preset?.id,
        userInput,
        inputImages,
        userId: session.userId,
        username: session.username,
        channelId_: session.channelId,
        guildId: session.guildId,
      })

      if (result.success) {
        const messages: any[] = [quote, ...result.outputImages.map(url => h.image(url))]
        const infoTexts: string[] = []
        if (this.config.showCost) {
          const shownCost = (result.cost ?? 0)
          const shownCurrency = result.currency || 'default'
          const costText = this.config.costTemplate
            .replaceAll('{cost}', String(shownCost))
            .replaceAll('{currency}', shownCurrency)
          infoTexts.push(costText)
        }
        if (this.config.showBalance && result.balanceAfter !== undefined) {
          const balanceText = this.config.balanceTemplate
            .replaceAll('{balance}', String(result.balanceAfter))
            .replaceAll('{currency}', result.currency || 'default')
          infoTexts.push(balanceText)
        }
        if (infoTexts.length > 0) messages.push(h.text('\n' + infoTexts.join('\n')))
        return messages
      } else {
        // 如果是余额不足，按模板输出
        const msg = String(result.error || '')
        const upperPrefix = 'INSUFFICIENT_BALANCE:'
        const lowerPattern = /^insufficient balance: need\s+(\d+(?:\.\d+)?)\s+(\S+)/i
        if (msg.startsWith(upperPrefix) || lowerPattern.test(msg)) {
          let balance: number | undefined
          let need: number | undefined
          let currency = result.currency || channel?.currency || 'default'
          const cost = channel?.cost || result.cost || 0

          if (msg.startsWith(upperPrefix)) {
            balance = parseFloat(msg.slice(upperPrefix.length))
            need = cost
          } else {
            const m = msg.match(lowerPattern)
            if (m) { need = parseFloat(m[1]); currency = m[2] || currency }
            try {
              const monetary: any = (this.ctx as any).monetary
              if (monetary && session.userId) balance = await (monetary.get?.(session.userId, currency) ?? monetary.getBalance?.(session.userId, currency))
            } catch {}
          }

          return this.config.insufficientBalanceTemplate
            .replaceAll('{cost}', String(cost))
            .replaceAll('{need}', String(need ?? cost))
            .replaceAll('{balance}', String(balance ?? ''))
            .replaceAll('{currency}', currency)
        }

        return `生成失败: ${result.error}`
      }
    } catch (error: any) {
      this.logger.error(`[Koishi指令失败] 渠道: ${channel?.name || '未知'}, 预设: ${preset?.name || '无'}, 原因: ${error?.message}`)
      this.logger.error(`[错误堆栈] ${error?.stack}`)

      // 余额不足：统一用配置模板输出（支持 {cost} {need} {balance} {currency}）
      const msg: string = String(error?.message || '')
      const upperPrefix = 'INSUFFICIENT_BALANCE:'
      const lowerPattern = /^insufficient balance: need\s+(\d+(?:\.\d+)?)\s+(\S+)/i
      if (msg.startsWith(upperPrefix) || lowerPattern.test(msg)) {
        let balance: number | undefined
        let need: number | undefined
        let currency = channel?.currency || 'default'
        const cost = channel?.cost || 0

        if (msg.startsWith(upperPrefix)) {
          balance = parseFloat(msg.slice(upperPrefix.length))
          need = cost
        } else {
          const m = msg.match(lowerPattern)
          if (m) { need = parseFloat(m[1]); currency = m[2] || currency }
          try {
            const monetary: any = (this.ctx as any).monetary
            if (monetary && session.userId) balance = await (monetary.get?.(session.userId, currency) ?? monetary.getBalance?.(session.userId, currency))
          } catch {}
        }

        return this.config.insufficientBalanceTemplate
          .replaceAll('{cost}', String(cost))
          .replaceAll('{need}', String(need ?? cost))
          .replaceAll('{balance}', String(balance ?? ''))
          .replaceAll('{currency}', currency)
      }

      return `生成失败: ${error?.message}`
    }
  }

  // 提取图片（当前消息 + 引用消息）
  private async extractImages(session: Session, maxImages: number = 3): Promise<FileData[]> {
    const images: FileData[] = []
    if (session.quote) images.push(...await extractImagesFromSession(session.quote as any))
    images.push(...await extractImagesFromSession(session))
    return images.slice(0, maxImages)
  }

  private formatResponse(quote: any, result: any) {
    if (Array.isArray(result)) return [quote, ...result.map(url => h.image(url))]
    return [quote, h.image(result)]
  }
}
