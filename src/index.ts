// Banana Pro 2.0 - 完全重构版本
import { Context, Logger } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Config } from './config'
import { extendDatabase } from './database'
import { BananaServices } from './services'
import { AdminAPI } from './modules/admin-api'
import { CommandRegistry } from './modules/command-registry'

export const name = 'banana-pro'
export const reusable = false

export const inject = {
  required: ["http", "logger", "i18n", "database", "chatluna"],
  optional: ['monetary', 'console']
}

export { Config } from './config'

export function apply(ctx: Context, config: Config) {
  const logger = new Logger(name)
  
  // 1. 扩展数据库
  extendDatabase(ctx)
  logger.info('✅ 数据库已扩展')
  
  // 2. 初始化服务层
  const services = new BananaServices(ctx, logger, config)
  logger.info('✅ 服务层已初始化')
  
  // 3. 注册控制台
  const baseDir = typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url))

  ctx.console.addEntry({
    dev: resolve(baseDir, '../client/index.ts'),
    prod: resolve(baseDir, '../dist')
  })
  logger.info('✅ 控制台已注册')
  
  // 4. 初始化指令注册器（用于 Koishi 指令交互）
  const commandRegistry = new CommandRegistry(ctx, logger, services, config)
  
  // 5. 注册管理 API（WebUI 后端，传入 commandRegistry 以便更新时重新加载指令）
  const adminAPI = new AdminAPI(ctx, logger, services, config, commandRegistry)
  adminAPI.register()
  logger.info('✅ 管理 API 已注册')
  
  // 6. 启动时加载指令和 API 预设
  ctx.on('ready', async () => {
    await commandRegistry.reloadCommands()
    logger.info('✅ Koishi 指令已加载')
    
    // 启动 API 预设自动同步
    services.apiPreset.startAutoSync()
  })
  
  logger.info('🎉 Banana Pro 2.0 已启动')
}
