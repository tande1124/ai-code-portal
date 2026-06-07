# AI 代码助手 Portal - 设计方案

## 1. 产品概述

一个在浏览器中运行的 AI 代码助手，能理解本地项目、回答代码问题、读取/修改文件、执行命令。

**目标用户**：开发者
**核心体验**：类似 Claude Code / Cursor，但基于网页

## 2. 技术栈

- **前端**：Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **AI SDK**：Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`)
- **模型**：MiniMax-M3
- **通信**：SSE (Server-Sent Events) 流式传输
- **包管理**：pnpm

## 3. 架构图

```
浏览器 (Next.js)
  ├── 聊天界面（流式渲染 + 工具调用可视化）
  ├── 文件树侧边栏
  ├── 代码对比展示
  └── 项目选择器
        │
        │ HTTP / SSE
        ▼
Next.js API 路由 (/api/chat)
  ├── Agent 编排器（LLM + 工具调用循环）
  │   ├── LLM: minimax-m3
  │   └── 工具: searchCode, readFile, editFile, createFile, listDir, runCommand, getProjectTree
  └── SSE 流式响应
```

## 4. 数据流

```
用户输入
  → API 路由 (/api/chat)
    → LLM 思考 → 返回 thinking 文本
    → LLM 决定调工具 → 返回 tool_start 事件
      → 工具执行 → 返回 tool_result 事件
      → LLM 拿到结果 → 继续思考
      → (重复直到完成)
    → LLM 返回最终文本回复
  → 所有事件通过 SSE 流式传到前端
```

## 5. 页面布局

```
┌──────────────────────────────────────────┐
│ 头部：项目路径输入框 + "打开"按钮          │
├──────────┬───────────────────────────────┤
│          │                               │
│ 文件树    │ 聊天消息区域                    │
│ 侧边栏    │  ├─ 用户消息气泡               │
│          │  ├─ Agent 消息气泡              │
│ (可折叠)  │  │  ├─ 文本内容                │
│          │  │  ├─ 工具调用卡片             │
│          │  │  │  ├─ 🔧 toolName(参数)     │
│          │  │  │  └─ ✓ 结果 (可折叠)       │
│          │  │  └─ 代码块 (语法高亮)        │
│          │  └─ 思考中动画                  │
│          │                               │
│          ├───────────────────────────────┤
│          │ 输入框 + 发送/停止按钮          │
├──────────┴───────────────────────────────┤
│ 状态栏 (Agent 状态 / Token 用量)          │
└──────────────────────────────────────────┘
```

## 6. 组件目录结构

```
src/
├── app/
│   ├── page.tsx               # 主页面（组合所有组件）
│   ├── layout.tsx             # 根布局
│   └── api/
│       └── chat/
│           └── route.ts       # Agent API 端点
├── components/
│   ├── ChatMessages.tsx       # 可滚动的消息列表
│   ├── MessageBubble.tsx      # 单条消息（用户/助手）
│   ├── ToolCallCard.tsx       # 工具调用可视化卡片
│   ├── ThinkingIndicator.tsx  # 思考中动画
│   ├── ChatInput.tsx          # 输入框 + 发送/停止
│   ├── FileTree.tsx           # 文件浏览器侧边栏
│   ├── ProjectSelector.tsx    # 项目路径输入
│   └── CodeBlock.tsx          # 语法高亮代码块
├── lib/
│   ├── tools/
│   │   ├── index.ts           # 工具注册表
│   │   ├── searchCode.ts      # 搜索项目代码
│   │   ├── readFile.ts        # 读取文件内容
│   │   ├── editFile.ts        # 修改文件
│   │   ├── createFile.ts      # 创建新文件
│   │   ├── listDir.ts         # 列出目录内容
│   │   ├── runCommand.ts      # 执行 shell 命令
│   │   └── getProjectMap.ts   # 获取项目结构树
│   ├── streaming.ts           # SSE 辅助工具
│   └── security.ts            # 路径穿越防护
└── types/
    └── index.ts               # 共享 TypeScript 类型
```

## 7. API 规范

### POST /api/chat

**请求体：**
```json
{
  "messages": [
    { "role": "user", "content": "帮我看看这个组件怎么优化" }
  ],
  "projectPath": "/Users/xxx/my-project"
}
```

**响应：SSE 流**
```
event: data
data: {"type":"thinking","content":"用户想优化组件，先找到对应文件..."}

event: data
data: {"type":"tool_start","toolCallId":"call_1","toolName":"searchCode","args":{"query":"MyComponent","filePattern":"*.tsx"}}

event: data
data: {"type":"tool_result","toolCallId":"call_1","result":{"files":["src/components/MyComponent.tsx"],"matches":[...]},"duration":320}

event: data
data: {"type":"text","content":"找到了 MyComponent，它的主要问题是..."}

event: data
data: {"type":"done","usage":{"promptTokens":150,"completionTokens":300}}
```

## 8. 类型定义

```typescript
// 后端发送给前端的流事件类型
type StreamEventType = 'thinking' | 'tool_start' | 'tool_result' | 'text' | 'error' | 'done'

interface StreamEvent {
  type: StreamEventType
  content?: string                // 'thinking' 和 'text' 类型使用
  toolCallId?: string            // 'tool_start' 和 'tool_result' 使用
  toolName?: string              // 'tool_start' 和 'tool_result' 使用
  args?: Record<string, unknown> // 'tool_start' 使用
  result?: unknown               // 'tool_result' 使用
  duration?: number              // 'tool_result' 使用 (毫秒)
  error?: string                 // 'error' 使用
  usage?: { promptTokens: number; completionTokens: number } // 'done' 使用
}

interface ToolInvocation {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  state: 'call' | 'result' | 'error'
  result?: unknown
  duration?: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolInvocations?: ToolInvocation[]
  createdAt: number
}
```

## 9. 工具定义

### searchCode(query: string, filePattern?: string)
- **描述**：在项目中搜索代码，支持关键词和通配符
- **实现**：使用 `grep -rn` 或 Node.js 的 fs 递归搜索
- **安全**：限制在项目目录内
- **使用场景**：用户问"找到 userApi 相关的代码"

### readFile(path: string, lineStart?: number, lineEnd?: number)
- **描述**：读取文件内容，可选指定行范围
- **实现**：`fs.readFileSync` 配合行切片
- **安全**：路径必须在项目目录下
- **使用场景**：Agent 需要理解文件内容后再做修改

### editFile(path: string, oldText: string, newText: string)
- **描述**：替换文件中的文本（精确匹配替换）
- **实现**：读取 → 确认 oldText 存在 → 替换 → 写入
- **安全**：路径穿越检查，文件必须在项目目录下
- **使用场景**：用户说"把 useQuery 改成 useSuspenseQuery"

### createFile(path: string, content: string, overwrite?: boolean)
- **描述**：创建新文件
- **实现**：`fs.writeFileSync`
- **安全**：路径穿越检查

### listDir(path: string, depth?: number)
- **描述**：列出目录内容（可递归）
- **实现**：`fs.readdirSync` 递归
- **使用场景**：Agent 探索项目结构

### runCommand(command: string, timeout?: number)
- **描述**：在项目目录中执行 shell 命令
- **实现**：`child_process.exec`
- **安全**：建议限制允许的命令范围
- **使用场景**：用户问"帮我跑一下测试"或"安装这个依赖"

### getProjectMap(maxDepth?: number)
- **描述**：获取项目目录树结构
- **实现**：递归遍历目录，自动忽略 .gitignore 中的文件

## 10. 实现顺序

### 第 1 步：项目脚手架
```bash
npx create-next-app@latest code-agent-portal --typescript --tailwind --app
cd code-agent-portal
npm install ai @ai-sdk/anthropic zod
```
- 配置 tsconfig、Tailwind 主题、全局样式

### 第 2 步：类型定义和工具库
- 创建 `src/types/index.ts`
- 创建 `src/lib/security.ts`（路径验证函数）
- 创建 `src/lib/tools/*.ts`（全部 7 个工具）

### 第 3 步：API 路由
- 创建 `src/app/api/chat/route.ts`
- Agent 循环：LLM → 调工具 → 执行 → LLM（最多 15 步）
- 使用自定义 SSE 流发送中间事件

### 第 4 步：前端组件
- ProjectSelector（项目路径输入 + 打开按钮）
- ChatInput（发送 + 停止按钮）
- MessageBubble（文本 + 工具调用卡片 + 代码块）
- ToolCallCard（工具调用可视化，可折叠展示参数和结果）
- ChatMessages（可滚动的消息列表）
- FileTree（文件夹/文件树）
- 主页面组合所有组件

### 第 5 步：集成测试
- 测试读文件
- 测试搜代码
- 测试修改文件
- 测试执行命令
- 测试错误处理和路径安全

## 11. 注意事项和约束

1. **安全**：所有文件操作必须验证路径在 projectPath 下。使用 `path.resolve` 并检查前缀。
2. **工具超时**：每个工具执行必须设置超时（默认 15 秒，可配置）。
3. **上下文窗口**：控制对话上下文长度。过长时自动截断，保留最近几轮对话 + 项目结构摘要。
4. **流式传输**：使用 Vercel AI SDK 的 `StreamingTextResponse` + 自定义数据流发送中间事件。
5. **LLM 选择**：推荐 Claude Sonnet 4，代码理解能力最强。备选 GPT-4o。
6. **错误处理**：每个工具调用都可能失败。在 ToolCallCard 中显示错误状态。
7. **环境变量**：`.env.local` 中需配置 `ANTHROPIC_API_KEY=sk-ant-...` 或 `OPENAI_API_KEY`

## 12. 给 Claude Code 的 Prompt

```
按照设计方案实现 AI 代码助手 Portal。按实现顺序一步步来：
1. 初始化项目
2. 创建类型定义
3. 实现所有工具
4. 实现 API 路由（Agent + SSE）
5. 实现前端组件
6. 集成测试

关键约束：
- 所有文件操作工具必须做路径安全检查
- SSE 流中要发送中间事件（thinking/tool_start/tool_result/text/done）
- 工具调用必须在 UI 中可视化展示
- 用 Claude Sonnet 4 作为 Agent 模型

每完成一步提示我继续。
```
