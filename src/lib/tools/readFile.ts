/**
 * readFile - 读取文件内容
 *
 * 支持可选行范围（lineStart / lineEnd，从 1 开始）。
 */

import * as fs from 'node:fs';
import { z } from 'zod';
import { resolveSafePath } from '../security';

export const readFileInputSchema = z.object({
  path: z.string().describe('文件路径（相对项目根或绝对）'),
  lineStart: z.number().int().min(1).optional().describe('起始行（1-based，可选）'),
  lineEnd: z.number().int().min(1).optional().describe('结束行（1-based，可选）'),
});

export const readFileToolDefinition = {
  description:
    '读取文件内容。可选地指定 lineStart 和 lineEnd 来只读取某个行范围（行号从 1 开始）。',
  inputSchema: readFileInputSchema,
};

export interface ReadFileResult {
  path: string;
  content: string;
  totalLines: number;
  /** 实际返回的行范围（如果用户指定了行范围） */
  range?: { start: number; end: number };
}

const MAX_BYTES = 1_000_000; // 1MB 上限，避免一次读爆内存

export async function executeReadFile(
  projectRoot: string,
  args: z.infer<typeof readFileInputSchema>,
): Promise<ReadFileResult> {
  const abs = resolveSafePath(projectRoot, args.path);
  const stat = fs.statSync(abs);
  if (!stat.isFile()) {
    throw new Error(`不是文件：${args.path}`);
  }
  if (stat.size > MAX_BYTES) {
    throw new Error(
      `文件过大（${stat.size} 字节 > ${MAX_BYTES} 字节），请用 lineStart/lineEnd 分段读取`,
    );
  }

  const raw = fs.readFileSync(abs, 'utf-8');
  const lines = raw.split('\n');
  const totalLines = lines.length;

  if (args.lineStart !== undefined || args.lineEnd !== undefined) {
    const start = Math.max(1, args.lineStart ?? 1);
    const end = Math.min(totalLines, args.lineEnd ?? totalLines);
    if (start > end) {
      throw new Error(`行范围无效：lineStart=${start} > lineEnd=${end}`);
    }
    const sliced = lines.slice(start - 1, end).join('\n');
    return { path: args.path, content: sliced, totalLines, range: { start, end } };
  }

  return { path: args.path, content: raw, totalLines };
}
