// 服务层统一导出
import { Context, Logger } from 'koishi'
import { ChannelService } from './channel.service'
import { PresetService } from './preset.service'
import { TaskService } from './task.service'
import { ApiPresetService } from './api-preset.service'

export * from './channel.service'
export * from './preset.service'
export * from './task.service'
export * from './api-preset.service'

/**
 * 服务管理器 - 聚合所有业务服务
 */
export class BananaServices {
  public channel: ChannelService
  public preset: PresetService
  public task: TaskService
  public apiPreset: ApiPresetService
  
  constructor(ctx: Context, logger: Logger, config: any) {
    this.channel = new ChannelService(ctx)
    this.preset = new PresetService(ctx)
    this.task = new TaskService(ctx, logger)
    this.apiPreset = new ApiPresetService(ctx, logger, this.preset, config)
  }
}
