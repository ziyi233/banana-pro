// 模块 2：画图请求处理模块
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
    private config: Config
  ) {}
  
  /**
   * 交互式处理画图请求 - 统一进入交互收集流程
   */
  async handleInteractive(
    session: Session,
    channel: BananaChannel,
    preset: BananaPreset | null,
    userInput: string,
    maxImages: number = 3,
    collectedText: string = '',
    collectedImages: FileData[] = []
  ) {
    // 1. 提取当前消息的图片和文本
    const currentImages = await this.extractImages(session, maxImages)
    const currentText = userInput.trim()
    
    // 2. 合并已收集的内容
    const allText = [collectedText, currentText].filter(Boolean).join(' ')
    const allImages = [...collectedImages, ...currentImages].slice(0, maxImages)
    
    this.logger.info(`[交互收集] 预设: ${preset?.name || '无'}, 当前文本: "${currentText}", 当前图片: ${currentImages.length}, 累计文本: "${allText}", 累计图片: ${allImages.length}`)
    
    // 3. 如果是第一次调用且已有图片，直接生成（不进入交互模式）
    const isFirstCall = collectedText === '' && collectedImages.length === 0
    if (isFirstCall && currentImages.length > 0) {
      this.logger.info(`[直接生成] 第一次调用且有图片，直接生成`)
      return await this.handle(session, channel, preset, allText, maxImages, allImages)
    }
    
    // 4. 检查是否是控制指令
    const trimmedInput = currentText.toLowerCase()
    if (trimmedInput === '开始' || trimmedInput === 'start') {
      // 用户确认开始生成
      if (!allText && allImages.length === 0) {
        return '❌ 没有收集到任何内容，请先发送图片或文字描述'
      }
      this.logger.info(`[交互确认] 用户确认开始生成`)
      return await this.handle(session, channel, preset, allText, maxImages, allImages)
    }
    
    if (trimmedInput === '取消' || trimmedInput === 'cancel') {
      this.logger.info(`[交互取消] 用户取消生成`)
      return '✅ 已取消生成'
    }
    
    // 5. 继续收集内容（进入交互模式）
    const hasUserTextPlaceholder = preset && preset.prompt.includes('{{userText}}')
    
    // 构建提示信息
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
    tips.push('  （60秒内有效）')
    
    await session.send(tips.join('\n'))
    
    // 6. 等待用户下一条消息
    return new Promise((resolve) => {
      const dispose = this.ctx.middleware(async (nextSession, next) => {
        // 只接收同一用户在同一频道的消息
        if (nextSession.userId === session.userId && 
            nextSession.channelId === session.channelId &&
            nextSession.guildId === session.guildId) {
          dispose()
          clearTimeout(timer)
          
          this.logger.info(`[交互收集] 收到用户新消息`)
          
          // 递归处理，传递已收集的内容
          const result = await this.handleInteractive(
            nextSession, 
            channel, 
            preset, 
            nextSession.content, 
            maxImages,
            allText,
            allImages
          )
          resolve(result)
        }
        return next()
      })
      
      // 60秒超时
      const timer = setTimeout(() => {
        dispose()
        resolve('⏱️ 等待超时，已自动取消')
      }, 60000)
    })
  }
  
  /**
   * 处理画图请求（主流程）- 直接调用 TaskService
   */
  async handle(
    session: Session,
    channel: BananaChannel,
    preset: BananaPreset | null,
    userInput: string,
    maxImages: number = 3,
    providedImages: FileData[] = []
  ) {
    const quote = h.quote(session.messageId)
    
    try {
      // 1. 使用提供的图片或提取当前消息的图片
      const images = providedImages.length > 0 ? providedImages : await this.extractImages(session, maxImages)
      const inputImages = images.map(img => ({
        data: Buffer.from(img.data).toString('base64'),
        mime: img.mime,
        filename: img.filename
      }))
      
      // 2. 调用 TaskService 生成图片
      const result = await this.services.task.generateImage({
        channelId: channel.id,
        presetId: preset?.id,
        userInput,
        inputImages,
        userId: session.userId,
        username: session.username,
        channelId_: session.channelId,
        guildId: session.guildId
      })
      
      // 3. 返回结果
      if (result.success) {
        const messages: any[] = [quote, ...result.outputImages.map(url => h.image(url))]
        
        // 构建提示信息
        const infoTexts: string[] = []
        
        // 显示消耗
        if (this.config.showCost && result.cost && result.cost > 0 && result.charged) {
          const costText = this.config.costTemplate
            .replace('{cost}', String(result.cost))
            .replace('{currency}', result.currency || 'default')
          infoTexts.push(costText)
        }
        
        // 显示余额（使用 TaskService 返回的余额）
        if (this.config.showBalance && result.balanceAfter !== undefined) {
          const balanceText = this.config.balanceTemplate
            .replace('{balance}', String(result.balanceAfter))
            .replace('{currency}', result.currency || 'default')
          infoTexts.push(balanceText)
        }
        
        // 添加提示信息
        if (infoTexts.length > 0) {
          messages.push(h.text('\n' + infoTexts.join('\n')))
        }
        
        return messages
      } else {
        return `生成失败: ${result.error}`
      }
      
    } catch (error) {
      this.logger.error(`[Koishi指令失败] 渠道: ${channel?.name || '未知'}, 预设: ${preset?.name || '无'}, 原因: ${error.message}`)
      this.logger.error(`[错误堆栈] ${error.stack}`)
      
      // 检查是否是余额不足错误（TaskService 抛出的特殊格式）
      if (error.message && error.message.startsWith('INSUFFICIENT_BALANCE:')) {
        const balance = parseFloat(error.message.split(':')[1])
        const currency = channel?.currency || 'default'
        const cost = channel?.cost || 0
        
        // 使用自定义模板
        const errorMsg = this.config.insufficientBalanceTemplate
          .replace('{cost}', String(cost))
          .replace('{balance}', String(balance))
          .replace('{currency}', currency)
        
        return errorMsg
      }
      
      return `生成失败: ${error.message}`
    }
  }
  
  /**
   * 提取图片（从当前消息和引用消息）
   */
  private async extractImages(session: Session, maxImages: number = 3): Promise<FileData[]> {
    const images: FileData[] = []
    
    // 1. 从引用消息中提取图片
    if (session.quote) {
      const quoteImages = await extractImagesFromSession(session.quote as any)
      images.push(...quoteImages)
    }
    
    // 2. 从当前消息中提取图片
    const currentImages = await extractImagesFromSession(session)
    images.push(...currentImages)
    
    // 3. 限制数量
    return images.slice(0, maxImages)
  }
  
  /**
   * 格式化响应
   */
  private formatResponse(quote: any, result: any) {
    if (Array.isArray(result)) {
      return [quote, ...result.map(url => h.image(url))]
    } else {
      return [quote, h.image(result)]
    }
  }
}
