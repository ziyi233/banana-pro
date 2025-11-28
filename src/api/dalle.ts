// DALL-E API 实现模块（Nano-banana Generations 格式）
import { Context, Logger } from 'koishi'
import { FileData, ApiResult } from '../types'

export interface DalleConfig {
  apiUrl: string
  apiKey: string
  apiParams: Record<string, any>
  loggerinfo: boolean
}

export async function callDalleApi(
  ctx: Context,
  logger: Logger,
  config: DalleConfig,
  files: FileData[],
  prompt: string
): Promise<ApiResult> {
  // 检查必要参数
  if (!config.apiParams) {
    throw new Error('DALL-E API 参数未配置')
  }
  
  // 构建 JSON 请求体（Nano-banana Generations 格式）
  const requestBody: Record<string, any> = {}
  const logParams: Record<string, any> = {}

  // 添加所有参数
  for (const key in config.apiParams) {
    const value = config.apiParams[key]

    let finalValue: any = value
    if (value === '{{prompt}}') {
      finalValue = prompt
    } else if (value === '{{inputimage}}') {
      // 如果有图片，转换为 base64 数组
      if (files && files.length > 0) {
        finalValue = files.map(file => {
          const base64 = Buffer.from(file.data).toString('base64')
          return `data:${file.mime};base64,${base64}`
        })
        // 如果只有一张图片，直接用字符串而不是数组
        if (finalValue.length === 1) {
          finalValue = finalValue[0]
        }
      } else {
        continue // 没有图片就跳过
      }
    } else {
      // 如果已经是数字，直接使用
      if (typeof value === 'number') {
        finalValue = value
      } else if (typeof value === 'string') {
        // 尝试转换为数字（如果看起来像数字）
        const numValue = Number(value)
        if (!isNaN(numValue) && value.trim() !== '') {
          finalValue = numValue
        }
      }
    }

    requestBody[key] = finalValue
    logParams[key] = typeof finalValue === 'string' && finalValue.length > 100 
      ? finalValue.substring(0, 100) + '...' 
      : finalValue
  }

  if (config.loggerinfo) {
    logger.info("发送 DALL-E API 请求:", {
      url: config.apiUrl,
      ...logParams,
      prompt: (logParams['prompt'] || '').substring(0, 100) + ((logParams['prompt'] || '').length > 100 ? '...' : ''),
    })
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json()
      const message = errorData.error?.message || errorData.error?.type || errorData.error?.code || `HTTP error! status: ${response.status}`
      throw new Error(message)
    }

    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      const result = await response.json()
      if (result.data && Array.isArray(result.data)) {
        // 提取所有有效的图片 URL
        const urls = result.data
          .filter(item => item && item.url)
          .map(item => item.url)

        if (urls.length > 0) {
          if (config.loggerinfo) {
            logger.info(`DALL-E API 成功响应 (JSON): 返回 ${urls.length} 张图片`)
          }
          // 如果只有一张图片，返回字符串；多张图片返回数组
          return urls.length === 1 ? urls[0] : urls
        }
      }
    } else if (contentType && contentType.startsWith("image/")) {
      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      if (config.loggerinfo) {
        logger.info(`DALL-E API 成功响应 (Image Buffer): data:${contentType};base64,[${base64.length} chars]`)
      }
      return `data:${contentType};base64,${base64}`
    }

    throw new Error("未知的 API 响应格式")
  } catch (error) {
    const errorMsg = error.message || '请求失败'
    ctx.logger.error(`DALL-E API 请求失败: ${errorMsg}`, error)
    if (errorMsg !== 'openai_error') {
      throw new Error(errorMsg)
    }
    return null
  }
}
