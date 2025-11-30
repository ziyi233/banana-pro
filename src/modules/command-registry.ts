import { Context, Command, Logger, Session } from 'koishi'
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
    private config: Config,
  ) {
    this.imageGenerator = new ImageGenerator(ctx, logger, services, config)
  }

  // 重新加载所有指令
  async reloadCommands() {
    this.logger.info('开始重新加载指令...')

    // 清空旧指令
    this.clearCommands()

    // 从数据库加载
    const channels = await this.ctx.database.get('banana_channel', { enabled: true })
    const presets = await this.ctx.database.get('banana_preset', { enabled: true })

    this.logger.info(`加载了 ${channels.length} 个渠道，${presets.length} 个预设`)

    // 为每个渠道注册指令
    for (const channel of channels) {
      await this.registerChannel(channel, presets, channels)
    }

    this.logger.info(`成功注册 ${this.registeredCommands.size} 个指令`)
  }

  // 为单个渠道注册指令
  private async registerChannel(channel: BananaChannel, presets: BananaPreset[], allChannels: BananaChannel[]) {
    // 父命令（无输入时展示帮助）
    const parentCmd = this.ctx
      .command(`${channel.name} [...text]`, channel.description || `${channel.name} 渠道`)
      .userFields(['id'])
      .option('images', '-i <count:number> 最多提取的图片数量', { fallback: 3 })
      .action(async ({ session }, ...args) => {
        if (!session) return
        // 显示帮助，只发送一次（优先合并转发）
        return await this.showSubcommands(session, allChannels, presets)
      })

    this.registeredCommands.set(channel.name, parentCmd)

    // 子命令（各预设）
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

          const result = await this.imageGenerator.handleInteractive(session, channel, preset, userInput, maxImages)
          return result as any
        })

      this.registeredCommands.set(`${channel.name}.${preset.name}`, subCmd)
    }
  }

  // 展示帮助（渠道 + 预设）。OneBot 平台发送一次合并转发
  private async showSubcommands(session: Session, channels: BananaChannel[], presets: BananaPreset[]) {
    // 第一段：渠道与价格
    const part1Lines: string[] = []
    part1Lines.push(`📋 现有可用渠道 ${channels.length} 个：`)
    if (channels.length === 0) {
      part1Lines.push('暂无可用渠道')
    } else {
      for (const ch of channels) {
        part1Lines.push(`- ${ch.name}: ${ch.cost} ${ch.currency}`)
      }
    }

    // 第二段：全部预设（全局共享）
    const part2Lines: string[] = []
    part2Lines.push(`🎛 全部预设 ${presets.length} 个（各渠道通用）：`)
    if (presets.length === 0) {
      part2Lines.push('暂无可用预设')
    } else {
      for (const p of presets) part2Lines.push(`- ${p.name}`)
    }

    const part1 = part1Lines.join('\n')
    const part2 = part2Lines.join('\n')

    // OneBot 平台：使用合并转发，仅一次
    const bot: any = session.bot as any
    const isOneBot = session.platform?.toLowerCase().startsWith('onebot')
    const selfId = (session as any).selfId || (bot?.sid) || ''
    const displayName = bot?.username || 'Banana-Pro'

    if (isOneBot && bot?.internal) {
      const nodes = [
        { type: 'node', data: { name: displayName, uin: selfId, content: part1 } },
        { type: 'node', data: { name: displayName, uin: selfId, content: part2 } },
      ]
      try {
        if (typeof bot.internal.send_group_forward_msg === 'function' && session.guildId) {
          await bot.internal.send_group_forward_msg({ group_id: session.guildId, messages: nodes })
          return
        }
        if (typeof bot.internal.send_private_forward_msg === 'function' && session.userId) {
          await bot.internal.send_private_forward_msg({ user_id: session.userId, messages: nodes })
          return
        }
      } catch {}
    }

    // 其他平台：回退为普通文本
    return part1 + '\n\n' + part2
  }

  // 清除所有已注册的指令
  private clearCommands() {
    for (const [name, cmd] of this.registeredCommands) {
      cmd.dispose()
      this.logger.info(`已清除指令 ${name}`)
    }
    this.registeredCommands.clear()
  }
}

