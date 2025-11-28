// Prompt 构建工具模块

/**
 * 构建最终的 prompt
 * @param template - prompt 模板，可包含 {{userText}} 占位符
 * @param userText - 用户输入的文本
 * @returns 构建后的 prompt
 */
export function buildPrompt(template: string, userText: string): string {
  if (!template) return userText
  
  // 检查模板中是否包含 {{userText}}
  if (template.includes('{{userText}}')) {
    // 如果包含，替换所有 {{userText}} 为用户文本
    return template.replace(/\{\{userText\}\}/g, userText)
  } else {
    // 如果不包含，默认追加到末尾
    return `${template}\n用户补充: ${userText}`
  }
}
