'use client';

import { useState } from 'react';
import type { ListDirEntry } from '@/types';

interface FileTreeProps {
  projectPath: string | null;
  tree: ListDirEntry[] | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * 折叠式文件树
 *
 * 数据由父组件传入（设计文档没有专门的 /api/project/tree 端点；
 * 主页面 page.tsx 在用户切换项目时通过调一个轻量 fetch 拉取树）。
 */
export function FileTree({ projectPath, tree, loading, error }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['.']));

  if (!projectPath) {
    return (
      <div className="p-4 text-xs text-fg-muted">
        先在上方选择一个项目路径，文件树就会显示在这里。
      </div>
    );
  }
  if (loading) {
    return <div className="p-4 text-xs text-fg-muted">加载项目结构…</div>;
  }
  if (error) {
    return <div className="p-4 text-xs text-accent-danger">错误：{error}</div>;
  }
  if (!tree || tree.length === 0) {
    return <div className="p-4 text-xs text-fg-muted">空目录</div>;
  }

  return (
    <div className="p-2 text-sm">
      {tree.map((entry) => (
        <TreeNode
          key={entry.name}
          node={entry}
          depth={0}
          expanded={expanded}
          onToggle={(path) => {
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(path)) next.delete(path);
              else next.add(path);
              return next;
            });
          }}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: ListDirEntry;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function TreeNode({ node, depth, expanded, onToggle }: TreeNodeProps) {
  if (node.type === 'file') {
    return (
      <div
        className="flex items-center gap-1.5 py-0.5 hover:bg-bg-tertiary rounded px-1"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <span className="text-fg-muted text-xs">📄</span>
        <span className="truncate text-fg-secondary text-xs">{node.name}</span>
        {node.size !== undefined && (
          <span className="ml-auto text-fg-muted text-[10px]">
            {formatSize(node.size)}
          </span>
        )}
      </div>
    );
  }

  const isOpen = expanded.has(node.name);
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.name)}
        className="w-full flex items-center gap-1.5 py-0.5 hover:bg-bg-tertiary rounded px-1"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <span className="text-fg-muted text-xs">{isOpen ? '▾' : '▸'}</span>
        <span className="text-fg-muted text-xs">📁</span>
        <span className="truncate text-fg-primary text-xs">{node.name}</span>
      </button>
      {isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={(p) => onToggle(`${node.name}/${p}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
