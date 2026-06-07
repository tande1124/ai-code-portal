'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/types';
import { MessageBubble } from './MessageBubble';

interface ChatMessagesProps {
  messages: Message[];
  streamingMessageId?: string;
}

export function ChatMessages({ messages, streamingMessageId }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-muted text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3">💬</div>
          <p>开始和 Agent 对话吧</p>
          <p className="mt-1 text-xs">例如：「列出项目结构」「帮我看看这个组件怎么优化」</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={msg.id === streamingMessageId}
        />
      ))}
    </div>
  );
}
