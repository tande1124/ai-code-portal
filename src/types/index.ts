/**
 * 共享 TypeScript 类型定义
 *
 * 包含后端 → 前端的流事件类型、消息结构、工具调用结构等。
 */

// ---------------------------------------------------------------------------
// SSE 流事件
// ---------------------------------------------------------------------------

/** 后端发送给前端的流事件类型 */
export type StreamEventType =
  | 'thinking' // LLM 思考文本
  | 'tool_start' // 工具调用开始
  | 'tool_result' // 工具调用结果
  | 'text' // 最终回复文本（增量）
  | 'error' // 错误
  | 'done'; // 流结束

/** 单个 SSE 事件 */
export interface StreamEvent {
  type: StreamEventType;
  /** thinking 和 text 类型使用 */
  content?: string;
  /** tool_start 和 tool_result 使用 */
  toolCallId?: string;
  /** tool_start 和 tool_result 使用 */
  toolName?: string;
  /** tool_start 使用 */
  args?: Record<string, unknown>;
  /** tool_result 使用 */
  result?: unknown;
  /** tool_result 使用（毫秒） */
  duration?: number;
  /** error 类型使用 */
  error?: string;
  /** done 类型使用 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// ---------------------------------------------------------------------------
// 工具调用（前端 UI 状态）
// ---------------------------------------------------------------------------

export type ToolInvocationState = 'call' | 'result' | 'error';

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: ToolInvocationState;
  result?: unknown;
  duration?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// 消息
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** 助手消息中包含的工具调用记录 */
  toolInvocations?: ToolInvocation[];
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Chat API 请求/响应
// ---------------------------------------------------------------------------

/** POST /api/chat 请求体 */
export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** 用户选择的本地项目绝对路径 */
  projectPath: string;
}

// ---------------------------------------------------------------------------
// 项目结构
// ---------------------------------------------------------------------------

/** 文件树节点（同时被后端 listDir 和前端 FileTree 使用） */
export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

/** listDir 工具的返回条目（与 FileTreeNode 形状一致，独立命名以区分 API） */
export type ListDirEntry = FileTreeNode;

// ---------------------------------------------------------------------------
// Agent 配置
// ---------------------------------------------------------------------------

export interface AgentConfig {
  model: string;
  maxSteps: number;
  toolTimeoutMs: number;
  projectPath: string;
}
