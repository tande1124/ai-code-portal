/**
 * listDir - 列出目录内容
 *
 * 支持递归（depth 控制深度）和默认忽略常见噪声目录。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { resolveSafePath } from '../security';

export const listDirInputSchema = z.object({
  path: z.string().describe('要列出的目录路径（相对项目根或绝对）'),
  depth: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe('递归深度，0 = 只列当前层（默认 0）'),
});

export const listDirToolDefinition = {
  description:
    '列出目录内容，可指定递归深度。返回的每个条目包含 name、type（file/directory）和 children（如果是目录）。',
  inputSchema: listDirInputSchema,
};

/** 默认忽略的目录名（不区分大小写） */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'out',
  '.turbo',
  '.cache',
  'coverage',
  '.vercel',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
]);

export interface ListDirEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: ListDirEntry[];
}

export async function executeListDir(
  projectRoot: string,
  args: z.infer<typeof listDirInputSchema>,
): Promise<ListDirEntry[]> {
  const abs = resolveSafePath(projectRoot, args.path);
  const stat = fs.statSync(abs);
  if (!stat.isDirectory()) {
    throw new Error(`不是目录：${args.path}`);
  }

  return walk(abs, args.depth ?? 0, 0);
}

function walk(dir: string, maxDepth: number, currentDepth: number): ListDirEntry[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const result: ListDirEntry[] = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.gitignore') {
      // 默认忽略隐藏文件/目录（保留 .env 和 .gitignore 方便用户查看）
    }

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const children =
        currentDepth < maxDepth ? walk(full, maxDepth, currentDepth + 1) : undefined;
      result.push({ name: entry.name, type: 'directory', children });
    } else if (entry.isFile()) {
      let size: number | undefined;
      try {
        size = fs.statSync(full).size;
      } catch {
        size = undefined;
      }
      result.push({ name: entry.name, type: 'file', size });
    }
  }

  // 目录优先，然后按名称排序
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}
