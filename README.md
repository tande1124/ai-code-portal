# AI 代码助手 Portal

在浏览器中运行的 AI 代码助手，能理解本地项目、读取/修改文件、执行命令。类似 Claude Code / Cursor 的网页版。

> 详细设计见 [DESIGN.md](./DESIGN.md)

## 技术栈

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Vercel AI SDK** + **MiniMax-M3**（OpenAI 兼容接口）
- **SSE** 流式传输（自实现中间事件协议）
- **pnpm** / npm

## 快速开始

### 1. 安装依赖

```bash
npm install
# 或 pnpm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local`，填入 MiniMax API Key：

```bash
cp .env.local.example .env.local
```

```env
MINIMAX_API_KEY=eyJhbGciOi...
```

> 在 [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) 获取 API Key。

> **更换模型**：把 `MINIMAX_MODEL` 改成其他模型名（默认 `MiniMax-M3`）。
> **更换 Base URL**：用 `MINIMAX_BASE_URL` 覆盖（默认 `https://api.minimax.io/v1`）。

### 3. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

### 4. 试用

1. 在顶部输入项目绝对路径（例如 `/Users/you/projects/my-app`），点「打开」
2. 左侧文件树展示项目结构
3. 在底部输入框提问，例如：
   - 「列出项目结构」
   - 「帮我看看 src/app/page.tsx 怎么优化」
   - 「把所有的 useState 改成 useReducer」
   - 「跑一下测试」

## 工具能力

Agent 可调用以下 7 个工具：

| 工具 | 功能 |
| --- | --- |
| `searchCode` | 在项目中搜索代码（grep 风格） |
| `readFile` | 读取文件内容（支持行范围） |
| `editFile` | 精确替换文件中的文本 |
| `createFile` | 创建新文件（默认拒绝覆盖） |
| `listDir` | 列出目录内容（可递归） |
| `runCommand` | 执行 shell 命令（带安全黑名单） |
| `getProjectMap` | 获取项目目录树 |

## 安全

- 所有文件操作都通过 `resolveSafePath` 校验路径必须在 `projectPath` 内
- `runCommand` 默认拒绝 `rm -rf /`、`sudo`、fork 炸弹、curl | sh 等危险命令
- 默认工具超时 15 秒（可通过参数调整）
- Agent 循环最多 15 步（防止失控）

## 架构

```
浏览器 (Next.js)
  ├── 聊天界面（流式渲染 + 工具调用可视化）
  ├── 文件树侧边栏
  └── 项目选择器
        │
        │ POST /api/chat (SSE)
        ▼
Next.js API 路由
  ├── streamText (Claude Sonnet 4.5)
  ├── 7 个工具（Zod 参数校验 + 路径安全检查）
  └── 自定义 SSE 协议：thinking / tool_start / tool_result / text / done
```

## 目录结构

```
src/
├── app/
│   ├── page.tsx                # 主页面
│   ├── layout.tsx              # 根布局
│   ├── globals.css             # 全局样式
│   └── api/
│       ├── chat/route.ts       # Agent + SSE 端点
│       └── project/tree/route.ts  # 文件树端点
├── components/                 # 8 个 React 组件
├── lib/
│   ├── security.ts             # 路径安全
│   ├── streaming.ts            # SSE 编码
│   └── tools/                  # 7 个工具 + 注册表
└── types/                      # 共享 TypeScript 类型
```

## 部署到 Vercel

```bash
npm i -g vercel
vercel
```

记得在 Vercel 控制台配置 `ANTHROPIC_API_KEY` 环境变量。

## 命令

```bash
npm run dev        # 启动开发服务器
npm run build      # 生产构建
npm run start      # 启动生产服务
npm run typecheck  # TypeScript 类型检查
npm run lint       # ESLint 检查
```

## 许可

MIT
