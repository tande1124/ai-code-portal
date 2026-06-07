'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessages } from '@/components/ChatMessages';
import { ChatInput } from '@/components/ChatInput';
import { FileTree } from '@/components/FileTree';
import { ProjectSelector } from '@/components/ProjectSelector';
import type { ListDirEntry, Message, StreamEvent, ToolInvocation } from '@/types';

interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export default function HomePage() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<ListDirEntry[] | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [statusText, setStatusText] = useState<string>('空闲');

  const abortRef = useRef<AbortController | null>(null);

  // 加载项目树
  const loadFileTree = useCallback(async (path: string) => {
    setFileTreeLoading(true);
    setFileTreeError(null);
    try {
      const res = await fetch(
        `/api/project/tree?path=${encodeURIComponent(path)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tree: ListDirEntry[] };
      setFileTree(data.tree);
    } catch (e) {
      setFileTree(null);
      setFileTreeError(e instanceof Error ? e.message : String(e));
    } finally {
      setFileTreeLoading(false);
    }
  }, []);

  const handleOpenProject = useCallback(
    (path: string) => {
      setProjectPath(path);
      void loadFileTree(path);
    },
    [loadFileTree],
  );

  // 打开项目后立刻拉一次
  useEffect(() => {
    if (projectPath) void loadFileTree(projectPath);
  }, [projectPath, loadFileTree]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStatusText('已停止');
    setStreamingId(null);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!projectPath) {
        setStatusText('请先选择项目');
        return;
      }

      // 1. 构造当前消息列表（前端 → 后端）
      const userMsg: Message = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: Date.now(),
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setUsage(null);
      setStatusText('思考中…');

      // 2. 准备一个空 assistant 消息用于接收流式内容
      const assistantId = `a_${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolInvocations: [],
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingId(assistantId);
      setIsStreaming(true);

      // 3. 工具调用记录（按 toolCallId 索引）
      const toolMap = new Map<string, ToolInvocation>();

      // 4. 发起 fetch + SSE
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            projectPath,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE 帧以 \n\n 分隔
          let sepIndex: number;
          while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            const event = parseSSEFrame(frame);
            if (event) applyStreamEvent(event);
          }
        }

        // 处理尾部残余
        if (buffer.trim()) {
          const event = parseSSEFrame(buffer);
          if (event) applyStreamEvent(event);
        }

        setStatusText('空闲');
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') {
          setStatusText('已停止');
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setStatusText(`错误：${msg}`);
          // 错误也要写到 assistant 消息里
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || `（请求失败：${msg}）` }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        setStreamingId(null);
        abortRef.current = null;
      }

      // 把所有 setState 调用集中在一个 helper 里，避免在 try 内重复声明逻辑
      function applyStreamEvent(event: StreamEvent): void {
        switch (event.type) {
          case 'thinking':
            setStatusText('思考中…');
            break;

          case 'text':
            if (event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m,
                ),
              );
            }
            break;

          case 'tool_start':
            if (event.toolCallId) {
              const inv: ToolInvocation = {
                toolCallId: event.toolCallId,
                toolName: event.toolName ?? '',
                args: event.args ?? {},
                state: 'call',
              };
              toolMap.set(event.toolCallId, inv);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolInvocations: [
                          ...(m.toolInvocations ?? []),
                          inv,
                        ],
                      }
                    : m,
                ),
              );
            }
            break;

          case 'tool_result':
            if (event.toolCallId) {
              const existing = toolMap.get(event.toolCallId);
              if (existing) {
                existing.state = 'result';
                existing.result = event.result;
                existing.duration = event.duration;
                toolMap.set(event.toolCallId, existing);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          toolInvocations: (m.toolInvocations ?? []).map((t) =>
                            t.toolCallId === event.toolCallId
                              ? { ...t, state: 'result', result: event.result, duration: event.duration }
                              : t,
                          ),
                        }
                      : m,
                  ),
                );
              }
            }
            break;

          case 'error':
            setStatusText(`错误：${event.error ?? '未知'}`);
            if (event.toolCallId && toolMap.has(event.toolCallId)) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolInvocations: (m.toolInvocations ?? []).map((t) =>
                          t.toolCallId === event.toolCallId
                            ? { ...t, state: 'error', error: event.error }
                            : t,
                        ),
                      }
                    : m,
                ),
              );
            } else {
              // 流级错误（没有具体 toolCallId）→ 直接写到 assistant 气泡内容
              // 用 ⛔ 前缀让用户一眼看出
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId && m.content.length === 0
                    ? {
                        ...m,
                        content: `⛔ 调用失败：${event.error ?? '未知错误'}\n\n请检查 .env.local 中的 MINIMAX_API_KEY / MINIMAX_BASE_URL / MINIMAX_MODEL 是否配置正确。`,
                      }
                    : m,
                ),
              );
            }
            break;

          case 'done':
            if (event.usage) {
              setUsage({
                promptTokens: event.usage.promptTokens,
                completionTokens: event.usage.completionTokens,
                totalTokens:
                  event.usage.promptTokens + event.usage.completionTokens,
              });
            }
            break;
        }
      }
    },
    [messages, projectPath],
  );

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="border-b border-border bg-bg-secondary px-4 py-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen((s) => !s)}
          className="text-fg-secondary hover:text-fg-primary text-sm px-2 py-1 rounded hover:bg-bg-tertiary"
          aria-label="切换侧边栏"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
        <h1 className="text-sm font-semibold text-fg-primary shrink-0">
          AI 代码助手
        </h1>
        <div className="flex-1 min-w-0">
          <ProjectSelector
            projectPath={projectPath}
            onOpen={handleOpenProject}
            disabled={isStreaming}
          />
        </div>
      </header>

      {/* 主体 */}
      <div className="flex-1 flex min-h-0">
        {/* 侧边栏 */}
        {sidebarOpen && (
          <aside className="w-64 shrink-0 border-r border-border bg-bg-secondary overflow-y-auto">
            <div className="px-3 py-2 text-xs text-fg-muted border-b border-border-muted">
              {projectPath ? `📂 ${projectPath}` : '未选择项目'}
            </div>
            <FileTree
              projectPath={projectPath}
              tree={fileTree}
              loading={fileTreeLoading}
              error={fileTreeError}
            />
          </aside>
        )}

        {/* 聊天区 */}
        <main className="flex-1 flex flex-col min-w-0">
          <ChatMessages messages={messages} streamingMessageId={streamingId ?? undefined} />
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={!projectPath}
            placeholder={
              projectPath
                ? '输入消息，回车发送，Shift+Enter 换行…'
                : '请先在顶部选择项目路径'
            }
          />
        </main>
      </div>

      {/* 状态栏 */}
      <footer className="border-t border-border bg-bg-secondary px-4 py-1.5 text-xs text-fg-muted flex items-center gap-4">
        <span>状态：{statusText}</span>
        {usage && (
          <span>
            Token：{usage.promptTokens}↑ / {usage.completionTokens}↓（合计{' '}
            {usage.totalTokens}）
          </span>
        )}
        {projectPath && <span className="ml-auto truncate max-w-[60%]">{projectPath}</span>}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SSE 帧解析（单帧）
// ---------------------------------------------------------------------------

function parseSSEFrame(frame: string): StreamEvent | null {
  let eventName: string | null = null;
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  try {
    return JSON.parse(dataLines.join('\n')) as StreamEvent;
  } catch {
    return null;
  }
}
