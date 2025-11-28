# Banana Pro 2.0

> AI 图片生成插件 - 完全重构版

## 🎯 核心概念

### 渠道（Channel）
每个渠道是一个**完整的 API 调用配置**，对应一个一级指令。

```typescript
{
  name: "dalle3",           // 指令名 -> /dalle3
  apiMode: "dalle",
  apiUrl: "https://...",
  apiKey: "sk-...",
  apiParams: {              // 固定的请求参数
    model: "dall-e-3",
    size: "1024x1024",
    quality: "hd"
  },
  cost: -1000              // 货币消耗
}
```

### 预设（Preset）
预设是**全局共享的 Prompt 模板**，作为子指令挂载到所有渠道。

```typescript
{
  name: "写实",
  prompt: "realistic photo, {{userText}}, high quality"
}
```

### 指令注册
- **父指令**：`/dalle3` - 无预设，直接使用用户输入
- **子指令**：`/dalle3.写实` - 使用写实预设

## 📊 数据库表结构

### banana_channel - 渠道配置表
```sql
id              INT PRIMARY KEY
name            VARCHAR(50) UNIQUE    -- 指令名
enabled         BOOLEAN
description     TEXT

-- API 配置
apiMode         ENUM('dalle', 'chatluna')
apiUrl          VARCHAR(255)
apiKey          VARCHAR(255)
apiParams       TEXT                  -- JSON 字符串

-- ChatLuna 配置
chatlunaModel   VARCHAR(100)

-- 货币配置
cost            DECIMAL(10,2)
currency        VARCHAR(20)

-- 元数据
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

### banana_preset - 预设库表
```sql
id              INT PRIMARY KEY
name            VARCHAR(50)
prompt          TEXT                  -- 支持 {{userText}} 变量
source          ENUM('api', 'user')   -- 来源
enabled         BOOLEAN
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

### banana_task - 任务记录表
```sql
id              INT PRIMARY KEY
userId          VARCHAR(50)
username        VARCHAR(100)
channelId       VARCHAR(50)
guildId         VARCHAR(50)

-- 调用信息
channelUsed     VARCHAR(50)           -- 使用的渠道
channelIdFk     INT                   -- 渠道 ID
presetUsed      VARCHAR(50)           -- 使用的预设
presetIdFk      INT                   -- 预设 ID

-- 请求内容
userInput       TEXT
finalPrompt     TEXT
inputImages     TEXT                  -- JSON 数组
outputImages    TEXT                  -- JSON 数组

-- 状态
status          ENUM('pending', 'processing', 'success', 'failed', 'refunded')
error           TEXT

-- 货币
cost            DECIMAL(10,2)
currency        VARCHAR(20)
refunded        BOOLEAN

-- 时间
startTime       TIMESTAMP
endTime         TIMESTAMP
duration        INT                   -- 毫秒
```

## 🏗️ 架构设计

### 三大模块

#### 1. CommandRegistry - 指令注册模块
```typescript
// src/modules/command-registry.ts
class CommandRegistry {
  async reloadCommands() {
    // 1. 从数据库加载渠道和预设
    // 2. 为每个渠道注册父指令
    // 3. 为每个预设注册子指令
  }
}
```

#### 2. ImageGenerator - 画图处理模块
```typescript
// src/modules/image-generator.ts
class ImageGenerator {
  async handle(session, channel, preset, userInput) {
    // 1. 构建 prompt
    // 2. 预扣费（TODO）
    // 3. 创建任务记录
    // 4. 提取图片
    // 5. 调用 API
    // 6. 更新任务状态
    // 7. 返回结果
    // 失败时：退款 + 记录错误
  }
}
```

#### 3. AdminAPI - 管理 API 模块（待实现）
```typescript
// src/modules/admin-api.ts
class AdminAPI {
  register(ctx) {
    // 渠道管理
    ctx.console.addListener('banana/channels/list')
    ctx.console.addListener('banana/channels/create')
    ctx.console.addListener('banana/channels/update')
    ctx.console.addListener('banana/channels/delete')
    
    // 预设管理
    ctx.console.addListener('banana/presets/list')
    ctx.console.addListener('banana/presets/create')
    
    // 任务查询
    ctx.console.addListener('banana/tasks/list')
    
    // 统计
    ctx.console.addListener('banana/stats/overview')
  }
}
```

## 🎨 WebUI 页面结构

```
Banana Pro 控制台
├── 渠道管理
│   ├── 渠道列表（表格）
│   ├── 添加/编辑对话框
│   └── 快速启用/禁用
│
├── Preset 库
│   ├── API Presets（只读）
│   └── 用户 Presets（可编辑）
│
├── 任务中心
│   ├── 进行中
│   └── 历史记录
│
├── 绘画广场
│   └── 图片展示
│
└── 统计面板
    └── 数据统计
```

## 📁 文件结构

```
src/
├── index.ts                    # 主入口
├── config.ts                   # 全局配置（极简）
├── database.ts                 # 数据库模型
│
├── modules/
│   ├── command-registry.ts    # 指令注册模块
│   ├── image-generator.ts     # 画图处理模块
│   └── admin-api.ts           # 管理 API（待实现）
│
├── api/
│   ├── dalle.ts               # DALL-E API
│   └── chatluna.ts            # ChatLuna API
│
└── utils/
    ├── prompt.ts              # Prompt 工具
    └── image.ts               # 图片工具

client/
├── index.ts                   # 前端入口
└── pages/
    ├── index.vue              # 主页面
    ├── channel-manager.vue    # 渠道管理（待实现）
    ├── preset-library.vue     # Preset 库（待实现）
    ├── task-center.vue        # 任务中心
    ├── gallery.vue            # 画廊
    └── stats.vue              # 统计

_old/                          # 旧代码备份
```

## 🔄 工作流程

### 用户调用指令
```
用户: /dalle3.写实 一只猫
  ↓
CommandRegistry 找到 dalle3 渠道配置
  ↓
ImageGenerator.handle()
  ├─ buildPrompt("realistic photo, 一只猫, high quality")
  ├─ 预扣费（TODO）
  ├─ createTask() → 记录到数据库
  ├─ extractImages()
  ├─ callAPI() → DALL-E API
  ├─ updateTaskSuccess()
  └─ 返回图片
```

### WebUI 管理
```
前端: 添加渠道
  ↓
send('banana/channels/create', data)
  ↓
AdminAPI.createChannel()
  ├─ database.create('banana_channel')
  └─ commandRegistry.reloadCommands()
  ↓
返回成功，指令立即生效
```

## ⚙️ 配置说明

### 全局配置（config.ts）
```yaml
# Prompt API 配置
enableApiPrompts: true
promptApiUrl: "https://prompt.vioaki.xyz/api/list"
autoRefreshInterval: 3600  # 秒

# WebUI 配置
pageTitle: "Banana Pro"
customCss: ""

# 日志配置
loggerinfo: false
logLevel: "info"

# 全局默认值
defaultTimeout: 60
defaultMaxRetries: 3
```

### 渠道配置（通过 WebUI）
所有渠道配置都通过 WebUI 管理，不在配置文件中。

## 🚧 待实现功能

### 高优先级
1. ✅ 数据库模型
2. ✅ 指令注册模块
3. ✅ 画图处理模块（基础）
4. ⏳ 管理 API 模块
5. ⏳ WebUI 页面

### 中优先级
6. ⏳ 货币系统（预扣费 + 退款）
7. ⏳ ChatLuna 支持
8. ⏳ 图片处理（提取和保存）
9. ⏳ 任务统计

### 低优先级
10. ⏳ 图片存储到文件系统
11. ⏳ 定时刷新 API Presets
12. ⏳ 权限控制
13. ⏳ 频率限制

## 📝 开发笔记

### 当前状态（2.0.0-beta.1）
- ✅ 数据库架构完成
- ✅ 核心模块框架完成
- ✅ 编译通过
- ⚠️ 货币系统暂时禁用
- ⚠️ ChatLuna 模式未实现
- ⚠️ 管理 API 未实现
- ⚠️ WebUI 未实现

### 已备份的旧代码
- `src/_old/index.ts.bak` - 旧的主入口
- `src/_old/prompts-manager.ts.bak` - 旧的 Prompts 管理器

### 下一步计划
1. 实现 AdminAPI 模块
2. 实现 WebUI 渠道管理页面
3. 实现 WebUI Preset 管理页面
4. 测试完整流程
5. 实现货币系统
6. 实现 ChatLuna 支持，chatluna直接作为可快速配置的渠道

## 🎓 设计原则

1. **数据驱动** - 所有配置存储在数据库
2. **模块化** - 清晰的模块划分
3. **可扩展** - 易于添加新功能
4. **用户友好** - WebUI 管理，无需编辑配置文件
5. **实时生效** - 修改后立即重新注册指令

## 📄 License

MIT
