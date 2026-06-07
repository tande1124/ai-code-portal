/**
 * POST /api/chat
 *
 * 接收用户消息和 projectPath，调用 LLM (Claude Sonnet 4) 进行 Agent 循环。
 * 把中间事件（thinking / tool_start / tool_result / text / done / error）以 SSE 流形式返回。
 *
 * 流程：
 *   1. 校验请求体（projectPath 必须存在）
 *   2. 构造 ReadableStream
 *   3. 进入 Agent 循环：streamText → 工具调用 → 最多 15 步
 *   4. 收集所有事件，编码为 SSE 帧写入流
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import {
  streamText,
  type CoreMessage,
  type LanguageModelUsage,
} from 'ai';
import { encodeSSE } from '@/lib/streaming';
import { buildTools } from '@/lib/tools';
import { isPathSafe } from '@/lib/security';
import type { ChatRequest, StreamEvent } from '@/types';

// 强制动态路由：确保请求时再执行
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // 需要 child_process 等 Node API

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

/**
 * MiniMax 模型配置（Anthropic 兼容接口）
 *
 * MiniMax 在 https://api.minimaxi.com/anthropic 提供了 Anthropic Messages API 兼容端点，
 * 实际可用的完整路径是 /anthropic/v1/messages。
 * 而 @ai-sdk/anthropic 的 URL 拼接规则是 `${baseURL}/messages`，
 * 所以 baseURL 必须以 `/v1` 结尾，否则 SDK 会拼成 `/anthropic/messages`（404）。
 */
const MINIMAX_BASE_URL =
  process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/anthropic/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY ?? '';
// 官方文档：Anthropic 兼容接口仅支持 M2.x 系列，M3 暂未提供
// 完整列表：https://platform.minimax.io/docs/api-reference/text-anthropic-api
const DEFAULT_MODEL = process.env.MINIMAX_MODEL ?? 'MiniMax-M2.7';
const MAX_STEPS = Number.parseInt(process.env.AGENT_MAX_STEPS ?? '15', 10);

/** 构造指向 MiniMax 的 Anthropic 兼容客户端 */
const minimax = createAnthropic({
  baseURL: MINIMAX_BASE_URL,
  apiKey: MINIMAX_API_KEY,
});

// 系统提示词：把 projectPath 注入给 Agent
function buildSystemPrompt(projectPath: string): string {
  return `你是一个运行在浏览器里的 AI 代码助手（类似 Claude Code / Cursor），可以读取、修改用户本地项目里的文件并执行 shell 命令。

当前用户的项目根目录是：
  ${projectPath}

约束与行为准则：
1. 所有文件操作都相对于上面的项目根目录；不要尝试访问该目录之外的任何路径。
2. 面对一个任务时，先用 getProjectMap 或 listDir 了解项目结构，再决定具体行动。
3. 每次只做一件明确的事：调一个工具 → 拿到结果 → 决定下一步。
4. 修改文件前先用 readFile 看清楚原文，再调 editFile（oldText 必须唯一匹配）。
5. 执行命令前先解释你要做什么，再调 runCommand。
6. 完成后给用户简短、清晰的总结。
7. 用中文回复，除非用户用其他语言提问。`;
}

// ---------------------------------------------------------------------------
// 路由处理
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  // 1. 解析与校验请求体
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: '请求体不是合法 JSON' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const { messages, projectPath } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'messages 必须是非空数组' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  if (typeof projectPath !== 'string' || projectPath.length === 0) {
    return new Response(
      JSON.stringify({ error: 'projectPath 是必填字段' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  if (!isPathSafe(projectPath, '.')) {
    return new Response(
      JSON.stringify({ error: `projectPath 不合法：${projectPath}` }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // 2. 准备 SSE 流
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = async (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch (err) {
          // 客户端可能已断开
          console.warn('[chat] SSE 写入失败（客户端可能断开）:', err);
        }
      };

      try {
        await runAgent({ messages, projectPath, write });
        closed = true;
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await write({ type: 'error', error: msg });
        try {
          closed = true;
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ---------------------------------------------------------------------------
// Agent 循环
// ---------------------------------------------------------------------------

interface RunAgentArgs {
  messages: ChatRequest['messages'];
  projectPath: string;
  write: (event: StreamEvent) => Promise<void>;
}

async function runAgent({ messages, projectPath, write }: RunAgentArgs): Promise<void> {
  // 构造 CoreMessage 列表
  const coreMessages: CoreMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const tools = buildTools(projectPath);
  const system = buildSystemPrompt(projectPath);

  // 用 stopWhen 控制最大步数（每 step = 一次 LLM 调用）
  const result = streamText({
    model: minimax(DEFAULT_MODEL),
    system,
    messages: coreMessages,
    tools,
    maxSteps: MAX_STEPS,
    onStepFinish: async (step) => {
      // 把 LLM 文本/思考产出转成流事件
      if (step.text) {
        await write({ type: 'text', content: step.text });
      }
    },
  });

  // 全链路用法：streamText 内部会自动处理工具调用循环；
  // 我们在 stream 完成后用 usage 做收尾。
  // 等待流结束（这里我们没有把 stream 透传给客户端，而是把中间事件用 SSE 转发）
  let usage: LanguageModelUsage | undefined;
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case 'text-delta': {
        // 增量文本
        await write({ type: 'text', content: chunk.textDelta });
        break;
      }

      case 'tool-call': {
        await write({
          type: 'tool_start',
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args: chunk.args as Record<string, unknown>,
        });
        break;
      }

      case 'tool-result': {
        await write({
          type: 'tool_result',
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          result: chunk.result,
          duration: undefined, // SDK 暂不提供，可在 tool execute 内部自己计时
        });
        break;
      }

      case 'error': {
        const errText =
          chunk.error instanceof Error
            ? chunk.error.message
            : typeof chunk.error === 'string'
              ? chunk.error
              : JSON.stringify(chunk.error);
        await write({ type: 'error', error: errText });
        break;
      }

      case 'finish': {
        usage = chunk.usage;
        break;
      }

      default:
        // 其他事件类型（reasoning / source / step-start 等）暂不处理
        break;
    }
  }

  await write({
    type: 'done',
    usage: usage
      ? {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
        }
      : undefined,
  });
}
