// 预设管理服务
import { Context } from 'koishi'
import { BananaPreset } from '../database'

export class PresetService {
  constructor(private ctx: Context) {}
  
  /**
   * 获取所有预设
   */
  async getAll(): Promise<BananaPreset[]> {
    return await this.ctx.database.get('banana_preset', {})
  }
  
  /**
   * 获取启用的预设
   */
  async getEnabled(): Promise<BananaPreset[]> {
    return await this.ctx.database.get('banana_preset', { enabled: true })
  }
  
  /**
   * 根据ID获取预设
   */
  async getById(id: number): Promise<BananaPreset | null> {
    const presets = await this.ctx.database.get('banana_preset', { id })
    return presets.length > 0 ? presets[0] : null
  }
  
  /**
   * 根据来源获取预设
   */
  async getBySource(source: 'api' | 'user'): Promise<BananaPreset[]> {
    return await this.ctx.database.get('banana_preset', { source })
  }
  
  /**
   * 创建预设
   */
  async create(data: Partial<BananaPreset>): Promise<BananaPreset> {
    if (!data.name || !data.prompt) {
      throw new Error('缺少必填字段: name, prompt')
    }
    
    return await this.ctx.database.create('banana_preset', {
      name: data.name,
      prompt: data.prompt,
      source: data.source || 'user',
      enabled: data.enabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    } as BananaPreset)
  }
  
  /**
   * 更新预设
   */
  async update(id: number, data: Partial<BananaPreset>): Promise<void> {
    await this.ctx.database.set('banana_preset', id, {
      ...data,
      updatedAt: new Date()
    })
  }
  
  /**
   * 删除预设
   */
  async delete(id: number): Promise<void> {
    await this.ctx.database.remove('banana_preset', id)
  }
  
  /**
   * 切换启用状态
   */
  async toggle(id: number, enabled: boolean): Promise<void> {
    await this.update(id, { enabled })
  }
  
  /**
   * 批量导入API预设
   */
  async importFromAPI(presets: Array<{ name: string, prompt: string }>): Promise<number> {
    let count = 0
    for (const preset of presets) {
      try {
        await this.create({
          name: preset.name,
          prompt: preset.prompt,
          source: 'api',
          enabled: true
        })
        count++
      } catch (error) {
        // 忽略重复的预设
        console.warn(`导入预设失败: ${preset.name}`, error)
      }
    }
    return count
  }
}
