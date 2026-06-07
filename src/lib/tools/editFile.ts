/**
 * editFile - 替换文件中的文本（精确匹配）
 *
 * 要求 oldText 在文件中唯一出现，否则报错（避免误替换多处）。
 */

import * as fs from 'node:fs';
import { z } from 'zod';
import { resolveSafePath } from '../security';

export const editFileInputSchema = z.object({
  path: z.string().describe('文件路径（相对项目根或绝对）'),
  oldText: z.string().describe('要被替换的原文（必须唯一匹配）'),
  newText: z.string().describe('替换后的新文本'),
});

export const editFileToolDefinition = {
  description:
    '把文件中某段文本（oldText）替换为 newText。要求 oldText 唯一出现一次，否则报错。',
  inputSchema: editFileInputSchema,
};

export interface EditFileResult {
  path: string;
  matchCount: number;
  newSize: number;
  oldSize: number;
  diffSummary: string;
}

export async function executeEditFile(
  projectRoot: string,
  args: z.infer<typeof editFileInputSchema>,
): Promise<EditFileResult> {
  const abs = resolveSafePath(projectRoot, args.path);
  if (!fs.existsSync(abs)) {
    throw new Error(`文件不存在：${args.path}`);
  }
  const original = fs.readFileSync(abs, 'utf-8');

  // 统计 oldText 出现次数
  let count = 0;
  let idx = -1;
  while ((idx = original.indexOf(args.oldText, idx + 1)) !== -1) count++;
  if (count === 0) {
    throw new Error(
      `未在文件 ${args.path} 中找到要替换的文本。请先用 readFile 确认原文。`,
    );
  }
  if (count > 1) {
    throw new Error(
      `要替换的文本在文件 ${args.path} 中出现 ${count} 次，必须唯一匹配。请提供更多上下文让 oldText 唯一。`,
    );
  }

  const updated = original.replace(args.oldText, args.newText);
  fs.writeFileSync(abs, updated, 'utf-8');

  return {
    path: args.path,
    matchCount: count,
    newSize: Buffer.byteLength(updated, 'utf-8'),
    oldSize: Buffer.byteLength(original, 'utf-8'),
    diffSummary: `替换 1 处；文件大小 ${original.length} → ${updated.length} 字符`,
  };
}
