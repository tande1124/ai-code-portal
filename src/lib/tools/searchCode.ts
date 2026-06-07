/**
 * searchCode - 在项目中搜索代码
 *
 * 使用 Node.js fs 递归遍历项目目录并做文本匹配。
 * 避免依赖 grep 等外部命令（Windows / 沙箱环境更兼容）。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { resolveSafePath } from '../security';

export const searchCodeInputSchema = z.object({
  query: z.string().describe('要搜索的字符串（区分大小写）'),
  filePattern: z
    .string()
    .optional()
    .describe('文件 glob 模式，如 "*.ts"、"*.tsx"（默认匹配所有文本文件）'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('最大结果数（默认 50）'),
});

export const searchCodeToolDefinition = {
  description:
    '在项目中搜索代码（grep 风格），支持 filePattern 文件名通配符。返回匹配的文件路径和上下文行。',
  inputSchema: searchCodeInputSchema,
};

export interface SearchMatch {
  file: string;
  line: number;
  text: string; // 该行内容
}

export interface SearchCodeResult {
  query: string;
  totalMatches: number;
  matches: SearchMatch[];
  files: string[];
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  'coverage',
  '.vercel',
  '__pycache__',
  '.venv',
  'venv',
]);

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.mp3', '.mp4', '.mov', '.wav', '.ogg',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.lock', '.lockb',
]);

const MAX_FILE_BYTES = 5_000_000; // 5MB

function matchGlob(pattern: string, name: string): boolean {
  // 简化版 glob：只支持 * 通配
  if (!pattern.includes('*')) return name === pattern;
  const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return regex.test(name);
}

export async function executeSearchCode(
  projectRoot: string,
  args: z.infer<typeof searchCodeInputSchema>,
): Promise<SearchCodeResult> {
  const absRoot = resolveSafePath(projectRoot, '.');
  const maxResults = args.maxResults ?? 50;

  const matches: SearchMatch[] = [];
  const filesSet = new Set<string>();
  let totalMatches = 0;

  walk(absRoot, (file) => {
    if (BINARY_EXT.has(path.extname(file).toLowerCase())) return;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return;
    }
    if (stat.size > MAX_FILE_BYTES) return;

    if (args.filePattern) {
      const base = path.basename(file);
      if (!matchGlob(args.filePattern, base)) return;
    }

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      return; // 二进制/权限问题
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(args.query)) {
        totalMatches++;
        if (matches.length < maxResults) {
          const rel = path.relative(absRoot, file);
          matches.push({
            file: rel,
            line: i + 1,
            text: lines[i].slice(0, 300), // 单行截断
          });
          filesSet.add(rel);
        }
      }
    }
  });

  return {
    query: args.query,
    totalMatches,
    matches,
    files: Array.from(filesSet),
  };
}

function walk(dir: string, onFile: (absPath: string) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.gitignore') {
      // 跳过隐藏目录
    }
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, onFile);
    } else if (entry.isFile()) {
      onFile(full);
    }
  }
}
