'use client';

import type { Message } from '@/types';
import { ToolCallCard } from './ToolCallCard';
import { CodeBlock } from './CodeBlock';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageBubbleProps {
  message: Message;
  /** 流式输出中（最后一条助手消息，且内容正在增长） */
  isStreaming?: boolean;
}

interface ParsedSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * 极简 markdown 切分：识别 ```lang ... ``` 代码块，其余按 text 处理。
 * 不做完整的 markdown 解析（避免引入额外依赖），但能正确处理 ``` 围栏代码块。
 */
function parseContent(raw: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const fence = /```([a-zA-Z0-9_+\-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = fence.exec(raw)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', content: raw.slice(lastIndex, m.index) });
    }
    segments.push({ type: 'code', content: m[2], language: m[1] || undefined });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < raw.length) {
    segments.push({ type: 'text', content: raw.slice(lastIndex) });
  }
  return segments;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-accent/15 border border-accent/30 text-fg-primary'
            : 'bg-bg-secondary border border-border text-fg-primary'
        }`}
      >
        <div className="text-xs text-fg-muted mb-1.5">
          {isUser ? '你' : 'Agent'}
        </div>

        {message.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="mb-2">
            {message.toolInvocations.map((inv) => (
              <ToolCallCard key={inv.toolCallId} invocation={inv} />
            ))}
          </div>
        )}

        {message.content && (
          <div className="prose-mini text-sm">
            {parseContent(message.content).map((seg, i) =>
              seg.type === 'code' ? (
                <CodeBlock key={i} code={seg.content} language={seg.language} />
              ) : (
                <span key={i} className="whitespace-pre-wrap break-words">
                  {seg.content}
                </span>
              ),
            )}
          </div>
        )}

        {isStreaming && !message.content && (
          <ThinkingIndicator />
        )}

        {isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 bg-fg-primary ml-0.5 align-text-bottom animate-pulse" />
        )}
      </div>
    </div>
  );
}
