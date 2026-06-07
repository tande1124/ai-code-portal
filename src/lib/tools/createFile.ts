/**
 * createFile - 创建新文件
 *
 * 默认拒绝覆盖已存在文件（需要显式 overwrite=true）。
 * 自动创建中间目录。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { resolveSafePath } from '../security';

export const createFileInputSchema = z.object({
  path: z.string().describe('新文件的路径（相对项目根或绝对）'),
  content: z.string().describe('文件内容'),
  overwrite: z
    .boolean()
    .optional()
    .describe('是否允许覆盖已存在文件（默认 false，避免误删）'),
});

export const createFileToolDefinition = {
  description:
    '创建新文件。默认拒绝覆盖已存在的文件，需显式设置 overwrite=true。会自动创建中间目录。',
  inputSchema: createFileInputSchema,
};

export interface CreateFileResult {
  path: string;
  bytes: number;
  created: boolean; // true = 新建；false = 覆盖
}

export async function executeCreateFile(
  projectRoot: string,
  args: z.infer<typeof createFileInputSchema>,
): Promise<CreateFileResult> {
  const abs = resolveSafePath(projectRoot, args.path);
  const exists = fs.existsSync(abs);
  if (exists && !args.overwrite) {
    throw new Error(
      `文件已存在：${args.path}。如需覆盖请显式传 overwrite=true`,
    );
  }

  // 确保父目录存在
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, args.content, 'utf-8');

  return {
    path: args.path,
    bytes: Buffer.byteLength(args.content, 'utf-8'),
    created: !exists,
  };
}
