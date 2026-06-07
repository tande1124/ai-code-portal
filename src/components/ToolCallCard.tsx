'use client';

import { useState } from 'react';
import type { ToolInvocation } from '@/types';

interface ToolCallCardProps {
  invocation: ToolInvocation;
}

const TOOL_ICONS: Record<string, string> = {
  searchCode: '🔍',
  readFile: '📄',
  editFile: '✏️',
  createFile: '📝',
  listDir: '📁',
  runCommand: '⚡',
  getProjectMap: '🗺️',
};

const TOOL_LABELS: Record<string, string> = {
  searchCode: '搜索代码',
  readFile: '读取文件',
  editFile: '编辑文件',
  createFile: '创建文件',
  listDir: '列出目录',
  runCommand: '执行命令',
  getProjectMap: '查看项目结构',
};

/** 把 args 对象渲染成 key: value 形式（字符串直接显示，对象 JSON） */
function renderArgs(args: Record<string, unknown>): React.ReactNode {
  const entries = Object.entries(args);
  if (entries.length === 0) return <span className="text-fg-muted">（无参数）</span>;
  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-fg-muted shrink-0">{k}:</span>
          <span className="text-fg-primary break-all font-mono text-xs">
            {typeof v === 'string' ? v : JSON.stringify(v, null, 2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderResult(result: unknown): React.ReactNode {
  if (result === undefined || result === null) {
    return <span className="text-fg-muted">（无返回）</span>;
  }
  if (typeof result === 'string') {
    return <pre className="whitespace-pre-wrap break-words text-xs">{result}</pre>;
  }
  return (
    <pre className="whitespace-pre-wrap break-words text-xs">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export function ToolCallCard({ invocation }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);

  const icon = TOOL_ICONS[invocation.toolName] ?? '🔧';
  const label = TOOL_LABELS[invocation.toolName] ?? invocation.toolName;

  const stateBadge =
    invocation.state === 'call'
      ? { text: '执行中…', color: 'bg-accent-warning/20 text-accent-warning' }
      : invocation.state === 'error'
        ? { text: '失败', color: 'bg-accent-danger/20 text-accent-danger' }
        : { text: '完成', color: 'bg-accent-success/20 text-accent-success' };

  return (
    <div className="my-2 rounded-md border border-border bg-bg-secondary">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-bg-tertiary transition-colors"
      >
        <span className="text-base">{icon}</span>
        <span className="text-sm font-medium text-fg-primary">
          {label}
          <span className="text-fg-muted font-normal">({invocation.toolName})</span>
        </span>
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded ${stateBadge.color}`}
        >
          {stateBadge.text}
        </span>
        {invocation.duration !== undefined && (
          <span className="text-xs text-fg-muted">{invocation.duration}ms</span>
        )}
        <span className="text-fg-muted text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-border-muted px-3 py-2 text-xs space-y-2">
          <div>
            <div className="text-fg-muted mb-1">参数</div>
            <div className="bg-bg-tertiary rounded p-2">
              {renderArgs(invocation.args)}
            </div>
          </div>
          {invocation.state === 'error' && invocation.error && (
            <div>
              <div className="text-accent-danger mb-1">错误</div>
              <div className="bg-bg-tertiary rounded p-2 text-accent-danger">
                {invocation.error}
              </div>
            </div>
          )}
          {invocation.state === 'result' && (
            <div>
              <div className="text-fg-muted mb-1">结果</div>
              <div className="bg-bg-tertiary rounded p-2 max-h-96 overflow-auto">
                {renderResult(invocation.result)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
