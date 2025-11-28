// Banana Pro 2.0 数据库模型
import { Context } from 'koishi'

declare module 'koishi' {
  interface Tables {
    banana_channel: BananaChannel
    banana_preset: BananaPreset
    banana_task: BananaTask
  }
}

// 渠道配置表（指令）
export interface BananaChannel {
  id: number
  name: string              // 指令名（唯一）
  enabled: boolean
  description: string
  
  // API 模式
  apiMode: 'dalle' | 'chatluna'
  
  // DALL-E 配置
  apiUrl: string
  apiKey: string
  model: string             // 模型名，如 "nano-banana"
  n: number                 // 生成图片数量，默认 1
  size: string              // 图片尺寸，如 "1024x1024"
  quality: string           // 图片质量，如 "standard" 或 "hd"
  style: string             // 图片风格，如 "vivid" 或 "natural"
  
  // ChatLuna 配置
  chatlunaModel: string     // 模型名
  
  // 扣费配置
  cost: number              // 负数=扣除，正数=奖励
  currency: string
  
  // 元数据
  createdAt: Date
  updatedAt: Date
}

// 预设表（全局共享）
export interface BananaPreset {
  id: number
  name: string              // 预设名称
  prompt: string            // Prompt 模板，支持 {{userText}} 变量
  source: 'api' | 'user'    // 来源
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

// 任务记录表
export interface BananaTask {
  id: number
  
  // 用户信息
  userId: string
  username: string
  channelId: string
  guildId: string
  
  // 调用信息
  channelUsed: string       // 使用的渠道
  channelIdFk: number       // 渠道 ID
  presetUsed: string        // 使用的预设（可为空）
  presetIdFk: number        // 预设 ID
  
  // 请求内容
  userInput: string         // 用户输入
  finalPrompt: string       // 最终 prompt
  inputImages: string       // JSON 数组
  
  // 结果
  outputImages: string      // JSON 数组
  status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded'
  error: string
  
  // 扣费信息
  cost: number
  currency: string
  refunded: boolean         // 是否已退款
  
  // 时间信息
  startTime: Date
  endTime: Date
  duration: number          // 毫秒
}

// 扩展数据库
export function extendDatabase(ctx: Context) {
  // 渠道表
  ctx.database.extend('banana_channel', {
    id: 'unsigned',
    name: 'string',
    enabled: 'boolean',
    description: 'text',
    apiMode: 'string',
    apiUrl: 'text',
    apiKey: 'text',
    model: 'string',
    n: 'unsigned',
    size: 'string',
    quality: 'string',
    style: 'string',
    chatlunaModel: 'string',
    cost: 'integer',
    currency: 'string',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  }, {
    autoInc: true,
    unique: ['name']
  })

  // 预设表
  ctx.database.extend('banana_preset', {
    id: 'unsigned',
    name: 'string',
    prompt: 'text',
    source: 'string',
    enabled: 'boolean',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
  })

  // 任务表（使用新字段名避免冲突）
  ctx.database.extend('banana_task', {
    id: 'unsigned',
    
    userId: 'string',
    username: 'string',
    channelId: 'string',
    guildId: 'string',
    
    channelUsed: 'string',      // 使用的渠道名
    channelIdFk: 'unsigned',    // 渠道 ID
    presetUsed: 'string',       // 使用的预设名
    presetIdFk: 'unsigned',     // 预设 ID
    
    userInput: 'text',
    finalPrompt: 'text',
    inputImages: 'text',
    
    outputImages: 'text',
    status: 'string',
    error: 'text',
    
    cost: 'double',
    currency: 'string',
    refunded: 'boolean',
    
    startTime: 'timestamp',
    endTime: 'timestamp',
    duration: 'unsigned',
  }, {
    primary: 'id',
    autoInc: true,
  })
}
