'use client';

import { useRef, useState, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  placeholder = '输入消息，回车发送，Shift+Enter 换行…',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return; // 流式输出时回车不发送
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // 自动撑高
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  return (
    <div className="border-t border-border bg-bg-secondary p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-accent disabled:opacity-50 max-h-[200px]"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 px-4 py-2 bg-accent-danger text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || value.trim().length === 0}
            className="shrink-0 px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
}
