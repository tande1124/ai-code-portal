'use client';

import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

/**
 * 简单的代码块组件：带复制按钮、轻量语法高亮（仅识别 language 标签）。
 * 避免引入 prism / shiki 以保持依赖最小。
 */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 浏览器可能拒绝剪贴板权限
    }
  };

  return (
    <div className="code-block my-2">
      <div className="flex items-center justify-between border-b border-border-muted pb-1.5 mb-2">
        <span className="text-xs text-fg-muted">{language ?? 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-fg-secondary hover:text-fg-primary transition-colors"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
