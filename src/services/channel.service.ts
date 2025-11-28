// 娓犻亾绠＄悊鏈嶅姟
import { Context } from 'koishi'
import { BananaChannel } from '../database'

export class ChannelService {
  constructor(private ctx: Context) {}
  
  /**
   * 鑾峰彇鎵€鏈夋笭閬?
   */
  async getAll(): Promise<BananaChannel[]> {
    return await this.ctx.database.get('banana_channel', {})
  }
  
  /**
   * 鑾峰彇鍚敤鐨勬笭閬?
   */
  async getEnabled(): Promise<BananaChannel[]> {
    return await this.ctx.database.get('banana_channel', { enabled: true })
  }
  
  /**
   * 鏍规嵁ID鑾峰彇娓犻亾
   */
  async getById(id: number): Promise<BananaChannel | null> {
    const channels = await this.ctx.database.get('banana_channel', { id })
    return channels.length > 0 ? channels[0] : null
  }
  
  /**
   * 鏍规嵁鍚嶇О鑾峰彇娓犻亾
   */
  async getByName(name: string): Promise<BananaChannel | null> {
    const channels = await this.ctx.database.get('banana_channel', { name })
    return channels.length > 0 ? channels[0] : null
  }
  
  /**
   * 鍒涘缓娓犻亾
   */
  async create(data: Partial<BananaChannel>): Promise<BananaChannel> {
    // 楠岃瘉蹇呭～瀛楁
    if (!data.name || !data.apiMode) {
      throw new Error('缂哄皯蹇呭～瀛楁: name, apiMode')
    }
    
    // 妫€鏌ュ悕绉版槸鍚﹀凡瀛樺湪
    const existing = await this.getByName(data.name)
    if (existing) {
      throw new Error(`娓犻亾鍚嶇О宸插瓨鍦? ${data.name}`)
    }
    
    // 鍒涘缓娓犻亾
    return await this.ctx.database.create('banana_channel', {
      name: data.name,
      enabled: data.enabled ?? true,
      description: data.description || '',
      apiMode: data.apiMode,
      apiUrl: data.apiUrl || '',
      apiKey: data.apiKey || '',
      model: data.apiMode === 'dalle' ? (data.model || 'nano-banana') : (data.model || ''),
      n: data.n ?? 1,
      size: (data.size ?? ''),
      quality: data.quality || '',
      style: data.style || '',
      chatlunaModel: data.chatlunaModel || '',
      cost: data.cost ?? 0,
      currency: data.currency || 'default',
      createdAt: new Date(),
      updatedAt: new Date()
    } as BananaChannel)
  }
  
  /**
   * 鏇存柊娓犻亾
   */
  async update(id: number, data: Partial<BananaChannel>): Promise<void> {
    await this.ctx.database.set('banana_channel', id, {
      ...data,
      updatedAt: new Date()
    })
  }
  
  /**
   * 鍒犻櫎娓犻亾
   */
  async delete(id: number): Promise<void> {
    await this.ctx.database.remove('banana_channel', id)
  }
  
  /**
   * 鍒囨崲鍚敤鐘舵€?
   */
  async toggle(id: number, enabled: boolean): Promise<void> {
    await this.update(id, { enabled })
  }
}

