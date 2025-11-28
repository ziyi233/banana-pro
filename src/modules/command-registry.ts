// 模块 1：指令注册模块
import { Context, Command, Logger } from 'koishi'
import { BananaChannel, BananaPreset } from '../database'
import { ImageGenerator } from './image-generator'
import { BananaServices } from '../services'
import { Config } from '../config'

export class CommandRegistry {
  private registeredCommands: Map<string, Command> = new Map()
  private imageGenerator: ImageGenerator
  
  constructor(
    private ctx: Context,
    private logger: Logger,
    private services: BananaServices,
    private config: Config
  ) {
    this.imageGenerator = new ImageGenerator(ctx, logger, services, config)
  }
  
  /**
   * 重新加载所有指令
   */
  async reloadCommands() {
    this.logger.info('开始重新加载指令...')
    
    // 1. 清除旧指令
    this.clearCommands()
    
    // 2. 从数据库加载
    const channels = await this.ctx.database.get('banana_channel', { enabled: true })
    const presets = await this.ctx.database.get('banana_preset', { enabled: true })
    
    this.logger.info(`加载到 ${channels.length} 个渠道，${presets.length} 个预设`)
    
    // 3. 为每个渠道注册指令
    for (const channel of channels) {
      await this.registerChannel(channel, presets)
    }
    
    this.logger.info(`成功注册 ${this.registeredCommands.size} 个指令`)
  }
  
  /**
   * 为单个渠道注册指令
   */
  private async registerChannel(channel: BananaChannel, presets: BananaPreset[]) {
    // 注册父指令（显示子指令列表）
    const parentCmd = this.ctx.command(`${channel.name} [...text]`, channel.description || `${channel.name} 渠道`)
      .userFields(['id'])
      .option('images', '-i <count:number> 最多提取的图片数量', { fallback: 3 })
      .action(async ({ session, options }, ...args) => {
        if (!session) return
        const userInput = args.join(' ')
        
        // 无输入，显示子指令列表
        return this.showSubcommands(channel, presets)
      })
    
    this.registeredCommands.set(channel.name, parentCmd)
    
    // 注册子指令（每个预设）
    for (const preset of presets) {
      const subCmd = parentCmd
        .subcommand(`.${preset.name} [...text]`, preset.name)
        .userFields(['id'])
        .option('images', '-i <count:number> 最多提取的图片数量', { fallback: 3 })
        .action(async ({ session, options }, ...args) => {
          if (!session) return
          const userInput = args.join(' ')
          const maxImages = options?.images || 3
          
          this.logger.info(`[子指令触发] 渠道: ${channel.name}, 预设: ${preset.name}, 用户输入: "${userInput}"`)
          
          // 交互式处理
          const result = await this.imageGenerator.handleInteractive(session, channel, preset, userInput, maxImages)
          return result as any
        })
      
      this.registeredCommands.set(`${channel.name}.${preset.name}`, subCmd)
    }
  }
  
  /**
   * 显示子指令列表
   */
  private showSubcommands(channel: BananaChannel, presets: BananaPreset[]): string {
    const lines: string[] = []
    
    lines.push(`📋 ${channel.name} - 可用预设`)
    lines.push(`💰 基础价格: ${channel.cost} ${channel.currency}`)
    lines.push('')
    
    if (presets.length === 0) {
      lines.push('暂无可用预设')
    } else {
      lines.push('使用方式: /' + channel.name + '.<预设名> <描述>')
      lines.push('')
      
      for (const preset of presets) {
        lines.push(`  • ${preset.name}`)
      }
    }
    
    lines.push('')
    
    return lines.join('\n')
  }
  
  /**
   * 清除所有已注册的指令
   */
  private clearCommands() {
    for (const [name, cmd] of this.registeredCommands) {
      cmd.dispose()
      this.logger.info(`已清除指令: ${name}`)
    }
    this.registeredCommands.clear()
  }
}
