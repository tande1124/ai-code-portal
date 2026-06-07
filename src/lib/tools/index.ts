/**
 * 工具注册表
 *
 * 集中导出所有工具的：
 *  - Vercel AI SDK 工具定义（name / description / inputSchema / execute）
 *  - 执行函数
 *  - zod schema
 *
 * 业务侧只需要 import { tools, executeToolByName } from '@/lib/tools' 即可。
 */

import { tool } from 'ai';
import { z } from 'zod';

import {
  listDirInputSchema,
  listDirToolDefinition,
  executeListDir,
} from './listDir';
import {
  readFileInputSchema,
  readFileToolDefinition,
  executeReadFile,
} from './readFile';
import {
  editFileInputSchema,
  editFileToolDefinition,
  executeEditFile,
} from './editFile';
import {
  createFileInputSchema,
  createFileToolDefinition,
  executeCreateFile,
} from './createFile';
import {
  searchCodeInputSchema,
  searchCodeToolDefinition,
  executeSearchCode,
} from './searchCode';
import {
  runCommandInputSchema,
  runCommandToolDefinition,
  executeRunCommand,
} from './runCommand';
import {
  getProjectMapInputSchema,
  getProjectMapToolDefinition,
  executeGetProjectMap,
} from './getProjectMap';

// ---------------------------------------------------------------------------
// Vercel AI SDK 工具定义（直接给 streamText 用）
// ---------------------------------------------------------------------------

/**
 * 构造一个工厂：把 execute 闭包 projectRoot 进去。
 * 每次请求时调用一次，传入当前用户的 projectPath。
 */
export function buildTools(projectRoot: string) {
  return {
    searchCode: tool({
      description: searchCodeToolDefinition.description,
      parameters: searchCodeInputSchema,
      execute: async (args: z.infer<typeof searchCodeInputSchema>) =>
        executeSearchCode(projectRoot, args),
    }),

    readFile: tool({
      description: readFileToolDefinition.description,
      parameters: readFileInputSchema,
      execute: async (args: z.infer<typeof readFileInputSchema>) =>
        executeReadFile(projectRoot, args),
    }),

    editFile: tool({
      description: editFileToolDefinition.description,
      parameters: editFileInputSchema,
      execute: async (args: z.infer<typeof editFileInputSchema>) =>
        executeEditFile(projectRoot, args),
    }),

    createFile: tool({
      description: createFileToolDefinition.description,
      parameters: createFileInputSchema,
      execute: async (args: z.infer<typeof createFileInputSchema>) =>
        executeCreateFile(projectRoot, args),
    }),

    listDir: tool({
      description: listDirToolDefinition.description,
      parameters: listDirInputSchema,
      execute: async (args: z.infer<typeof listDirInputSchema>) =>
        executeListDir(projectRoot, args),
    }),

    runCommand: tool({
      description: runCommandToolDefinition.description,
      parameters: runCommandInputSchema,
      execute: async (args: z.infer<typeof runCommandInputSchema>) =>
        executeRunCommand(projectRoot, args),
    }),

    getProjectMap: tool({
      description: getProjectMapToolDefinition.description,
      parameters: getProjectMapInputSchema,
      execute: async (args: z.infer<typeof getProjectMapInputSchema>) =>
        executeGetProjectMap(projectRoot, args),
    }),
  };
}

export type ToolName =
  | 'searchCode'
  | 'readFile'
  | 'editFile'
  | 'createFile'
  | 'listDir'
  | 'runCommand'
  | 'getProjectMap';

// 重新导出，方便使用方按需引入
export {
  executeSearchCode,
  executeReadFile,
  executeEditFile,
  executeCreateFile,
  executeListDir,
  executeRunCommand,
  executeGetProjectMap,
};
