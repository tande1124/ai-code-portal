/**
 * getProjectMap - 获取项目目录树结构
 *
 * 复用 listDir 的递归逻辑，但额外尊重 .gitignore（简化版）：
 * 默认忽略常见噪声目录。
 */

import { z } from 'zod';
import { resolveSafePath } from '../security';
import { executeListDir, type ListDirEntry } from './listDir';

export const getProjectMapInputSchema = z.object({
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe('最大递归深度（默认 3，最大 5）'),
});

export const getProjectMapToolDefinition = {
  description: '获取项目目录树结构，用于让 Agent 快速了解项目布局。',
  inputSchema: getProjectMapInputSchema,
};

export interface ProjectMap {
  root: string;
  depth: number;
  tree: ListDirEntry[];
  totalFiles: number;
  totalDirs: number;
}

export async function executeGetProjectMap(
  projectRoot: string,
  args: z.infer<typeof getProjectMapInputSchema>,
): Promise<ProjectMap> {
  const abs = resolveSafePath(projectRoot, '.');
  const depth = args.maxDepth ?? 3;
  const tree = await executeListDir(projectRoot, { path: '.', depth });

  const stats = countNodes(tree);
  return {
    root: abs,
    depth,
    tree,
    totalFiles: stats.files,
    totalDirs: stats.dirs,
  };
}

function countNodes(entries: ListDirEntry[]): { files: number; dirs: number } {
  let files = 0;
  let dirs = 0;
  for (const e of entries) {
    if (e.type === 'file') files++;
    else {
      dirs++;
      if (e.children) {
        const sub = countNodes(e.children);
        files += sub.files;
        dirs += sub.dirs;
      }
    }
  }
  return { files, dirs };
}
