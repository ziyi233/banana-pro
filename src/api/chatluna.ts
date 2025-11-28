// ChatLuna 适配器模块 - 参考 actions 插件实现
import { Context, Logger, h } from 'koishi'
import { FileData } from '../types'
import { HumanMessage } from '@langchain/core/messages'

export interface ChatLunaConfig {
  model: string  // 格式: "platform/model-name", 如 "openai/gpt-4-vision-preview"
  chatMode?: 'chat' | 'plugin'
  prompt?: string
  images?: string[]
}

/**
 * 使用 ChatLuna 生成图片（参考 actions 插件）
 */
export async function callChatLunaApi(
  ctx: Context,
  logger: Logger,
  config: ChatLunaConfig,
  files: FileData[],
  prompt: string
): Promise<string[]> {
  try {
    // 检查模型是否存在
    if (!config.model || ctx.chatluna.platform.findModel(config.model).value == null) {
      throw new Error(`模型不存在或未配置: ${config.model}`)
    }

    logger.info(`[ChatLuna] 使用模型: ${config.model}`)
    logger.info(`[ChatLuna] 模式: ${config.chatMode || 'chat'}`)
    logger.info(`[ChatLuna] 图片数量: ${files.length}`)

    // 构建消息内容（包含文字和图片）
    const messageContent: any[] = []
    
    // 添加文字
    if (prompt) {
      messageContent.push({
        type: 'text',
        text: prompt
      })
    }
    
    // 添加图片
    for (const file of files) {
      const base64 = Buffer.from(file.data).toString('base64')
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${file.mime};base64,${base64}`
        }
      })
    }

    // 创建 HumanMessage
    const humanMessage = new HumanMessage({
      content: messageContent
    })

    // 创建模型
    const llmRef = await ctx.chatluna.createChatModel(config.model)
    
    if (!llmRef.value) {
      throw new Error(`无法创建模型: ${config.model}`)
    }

    const llm = llmRef.value

    // 调用模型
    logger.info(`[ChatLuna] 开始调用模型...`)
    const result = await llm.invoke([humanMessage])
    
    logger.info(`[ChatLuna] 返回内容类型: ${typeof result.content}`)
    
    // 使用 ChatLuna 的 renderer 渲染结果（和 actions 一样）
    const mdRenderer = await ctx.chatluna.renderer.getRenderer('text')
    const rendered = await mdRenderer.render({ content: result.content }, { type: 'text' })
    
    logger.info(`[ChatLuna] 渲染后的元素: ${rendered.element}`)
    
    // 直接从字符串中提取图片 URL（使用正则表达式）
    const imageUrls: string[] = []
    let elementStr: string
    if (typeof rendered.element === 'string') {
      elementStr = rendered.element
    } else {
      // Element 对象，转换为字符串
      elementStr = String(rendered.element)
    }
    
    logger.info(`[ChatLuna] 元素字符串类型: ${typeof elementStr}, 内容: ${elementStr}`)
    
    // 提取 <img src="..."/> 或 <image url="..."/>
    const imgSrcMatches = elementStr.match(/<img[^>]+src=["']([^"']+)["']/gi)
    if (imgSrcMatches) {
      for (const match of imgSrcMatches) {
        const urlMatch = match.match(/src=["']([^"']+)["']/)
        if (urlMatch && urlMatch[1]) {
          logger.info(`[ChatLuna] 找到图片: ${urlMatch[1]}`)
          imageUrls.push(urlMatch[1])
        }
      }
    }
    
    const imageUrlMatches = elementStr.match(/<image[^>]+url=["']([^"']+)["']/gi)
    if (imageUrlMatches) {
      for (const match of imageUrlMatches) {
        const urlMatch = match.match(/url=["']([^"']+)["']/)
        if (urlMatch && urlMatch[1]) {
          logger.info(`[ChatLuna] 找到图片: ${urlMatch[1]}`)
          imageUrls.push(urlMatch[1])
        }
      }
    }
    
    if (imageUrls.length > 0) {
      logger.info(`[ChatLuna] 提取到 ${imageUrls.length} 个图片`)
      return imageUrls
    }

    // 如果没有图片，返回渲染后的文本
    logger.warn(`[ChatLuna] 未找到图片，返回渲染内容`)
    return [elementStr]

  } catch (error) {
    logger.error(`[ChatLuna] 请求失败: ${error.message}`)
    throw error
  }
}
