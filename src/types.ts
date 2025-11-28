// 类型定义模块

export interface Command {
  name: string
  prompt: string
  enabled: boolean
}

export interface FileData {
  data: ArrayBuffer
  mime: string
  filename: string
}

export interface ApiPromptResponse {
  current_page: number
  data: Array<{
    title: string
    prompt: string
  }>
}

/**
 * API 调用结果
 * 可以是单个 URL/base64，或多个 URL/base64 数组
 */
export type ApiResult = string | string[] | null
