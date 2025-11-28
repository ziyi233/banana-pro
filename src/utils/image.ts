// 图片处理工具模块
import { h, Session } from 'koishi'
import { FileData } from '../types'

/**
 * 判断字符串是否为 base64 图片
 */
export function isBase64Image(str: string): boolean {
  if (!str) return false
  // 检查是否是 data URL 格式
  if (str.startsWith('data:image/')) {
    return true
  }
  // 检查是否是纯 base64（没有 data: 前缀）
  // base64 字符串通常很长，且只包含 A-Z, a-z, 0-9, +, /, =
  if (str.length > 100 && /^[A-Za-z0-9+/]+=*$/.test(str)) {
    return true
  }
  return false
}

/**
 * 处理图片数据，自动识别 base64 或 URL
 */
export function processImageData(data: string): string {
  if (isBase64Image(data)) {
    // 如果是纯 base64（没有 data: 前缀），添加默认前缀
    if (!data.startsWith('data:')) {
      return `data:image/png;base64,${data}`
    }
    return data
  }
  // 否则当作 URL 返回
  return data
}

/**
 * 截断 base64 字符串用于日志输出
 */
export function truncateBase64ForLog(str: string, maxLength: number = 80): string {
  if (isBase64Image(str)) {
    return str.substring(0, maxLength) + `... [长度: ${str.length}]`
  }
  return str
}

/**
 * 为日志输出处理 JSON，自动截断 base64 数据
 */
export function stringifyWithBase64Truncation(obj: any, maxLength: number = 100): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'string' && isBase64Image(value)) {
      return value.substring(0, maxLength) + `... [base64 数据已截断, 总长度: ${value.length}]`
    }
    if (key === 'image_url' && value?.url?.startsWith('data:image/')) {
      return { url: value.url.substring(0, 80) + '... [base64 已截断]' }
    }
    return value
  }, 2)
}

/**
 * 从消息中提取图片元素
 */
export async function extractImagesFromSession(session: Session): Promise<FileData[]> {
  const images: FileData[] = []
  
  // 从消息元素中提取图片
  for (const element of session.elements) {
    if (element.type === 'img' || element.type === 'image') {
      const url = element.attrs?.src || element.attrs?.url
      if (!url) continue
      
      try {
        // 下载图片
        const response = await fetch(url)
        if (!response.ok) continue
        
        const arrayBuffer = await response.arrayBuffer()
        const contentType = response.headers.get('content-type') || 'image/png'
        
        images.push({
          data: arrayBuffer,
          mime: contentType,
          filename: `image_${images.length}.${contentType.split('/')[1] || 'png'}`
        })
      } catch (error) {
        console.warn(`下载图片失败: ${url}`, error)
      }
    }
  }
  
  return images
}
