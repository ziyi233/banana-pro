import { Schema } from 'koishi'

export interface Config {
  enableApiPrompts: boolean
  promptApiUrl: string
  autoRefreshInterval: number

  pageTitle: string
  webuiUserId: string

  // 交互提示配置
  showBalance: boolean
  showCost: boolean
  balanceTemplate: string
  costTemplate: string
  insufficientBalanceTemplate: string
  showStartMessage: boolean
  startMessageTemplate: string

  loggerinfo: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  defaultTimeout: number
  defaultMaxRetries: number
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    enableApiPrompts: Schema.boolean().default(true),
    promptApiUrl: Schema.string().default('https://prompt.vioaki.xyz/api/list'),
    autoRefreshInterval: Schema.number().default(3600),
    pageTitle: Schema.string().default('Banana Pro').description('WebUI 页面标题'),
    webuiUserId: Schema.string().description('WebUI 使用的用户 ID（用于计费）'),
  }).description('在线获取预设配置'),
  Schema.object({
    showBalance: Schema.boolean().default(true).description('生成成功后显示余额'),
    showCost: Schema.boolean().default(true).description('生成成功后显示消耗'),
    balanceTemplate: Schema.string().default('💰 余额: {balance} {currency}').description('余额显示模板（支持 {balance} 和 {currency} 变量）'),
    costTemplate: Schema.string().default('💸 消耗: {cost} {currency}').description('消耗显示模板（支持 {cost} 和 {currency} 变量）'),
    insufficientBalanceTemplate: Schema.string().default('❌ 余额不足！需要 {need} {currency}，当前余额: {balance} {currency}').description('余额不足提示模板（支持 {cost}、{need}、{balance} 和 {currency} 变量）'),
    showStartMessage: Schema.boolean().default(true).description('开始处理时发送提示'),
    startMessageTemplate: Schema.string().default('⏳ 正在处理，请稍候...').description('开始处理提示模板'),
  }).description('交互提示配置'),
  Schema.object({
    loggerinfo: Schema.boolean().default(false),
    logLevel: Schema.union(['debug', 'info', 'warn', 'error'] as const).default('info'),
  }),
  Schema.object({
    defaultTimeout: Schema.number().default(60),
    defaultMaxRetries: Schema.number().default(3),
  }),
]).description('Banana Pro 配置（指令与 WebUI）') as Schema<Config>

export default Config

