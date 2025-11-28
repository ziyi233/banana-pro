// ChatLuna 模型服务
// 完全参考 chatluna-actions 的实现
import { Context, Service } from 'koishi'

export class BananaModelService extends Service {
  private _chains: Record<string, any> = {}

  constructor(ctx: Context) {
    super(ctx, 'chatluna_banana_model')
  }

  /**
   * 获取或创建 ChatLuna 模型链
   */
  async getChain(
    key: string,
    model: string,
    prompt: string,
    chatMode: 'chat' | 'plugin' = 'chat'
  ) {
    if (this._chains[key]) {
      return this._chains[key]
    }

    try {
      // 动态导入 ChatLuna 相关模块（运行时导入）
      const chatluna = await import('koishi-plugin-chatluna')
      const { computed } = chatluna
      const langchainCore = await import('@langchain/core/messages')
      const { SystemMessage } = langchainCore
      const chatlunaPrompt = await import('koishi-plugin-chatluna/llm-core/chain/prompt')
      const { ChatLunaChatPrompt } = chatlunaPrompt

      // 创建预设模板
      const currentPreset = computed(
        () =>
          ({
            triggerKeyword: [key],
            rawText: prompt,
            messages: prompt != null && prompt.trim().length > 0
              ? [new SystemMessage(prompt)]
              : [],
            config: {}
          })
      )

      // 创建 ChatLuna 模型
      const llm = await this.ctx.chatluna.createChatModel(model)

      if (llm.value == null) {
        throw new Error('无法创建 ChatLuna 模型')
      }

      // 创建链
      await this._createChain(currentPreset, llm, key, chatMode, ChatLunaChatPrompt, computed)

      return this._chains[key]
    } catch (error) {
      throw new Error(`创建 ChatLuna 模型链失败: ${error}`)
    }
  }

  private async _createChain(
    currentPreset: any,
    llmRef: any,
    key: string,
    chatMode: 'chat' | 'plugin',
    ChatLunaChatPrompt: any,
    computed: any
  ) {
    const chatPrompt = computed(() => {
      const llm = llmRef.value
      return new ChatLunaChatPrompt({
        preset: currentPreset,
        tokenCounter: (text: string) => llm.getNumTokens(text),
        sendTokenLimit:
          llm.invocationParams().maxTokenLimit ??
          llm.getModelMaxContextSize(),
        promptRenderService: this.ctx.chatluna.promptRenderer
      })
    })

    // 只支持 chat 模式，plugin 模式暂不实现
    this._chains[key] = computed(() => [
      chatPrompt.value.pipe(llmRef.value),
      llmRef.value
    ])
  }
}

declare module 'koishi' {
  interface Context {
    chatluna_banana_model: BananaModelService
  }
}
