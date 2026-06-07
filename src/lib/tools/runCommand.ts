/**
 * runCommand - 在项目目录中执行 shell 命令
 *
 * 安全策略：
 *  - 默认拒绝包含 `rm -rf /`、`sudo`、重定向到 `/` 等危险模式的命令
 *  - 默认 15 秒超时（可通过 timeout 参数覆盖）
 *  - 强制在 projectRoot 目录下执行（cwd）
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import { z } from 'zod';
import { resolveSafePath } from '../security';

const execAsync = promisify(exec);

export const runCommandInputSchema = z.object({
  command: z.string().describe('要执行的 shell 命令'),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(120_000)
    .optional()
    .describe('超时（毫秒），默认 15000，最大 120000'),
});

export const runCommandToolDefinition = {
  description:
    '在项目目录下执行 shell 命令。默认 15 秒超时。危险命令（如 rm -rf /、sudo）会被拒绝。',
  inputSchema: runCommandInputSchema,
};

/** 命令执行结果结构体 */
export interface RunCommandResult {
  /** 原始执行的 shell 命令 */
  command: string;
  /** 命令执行的工作目录（相对项目根目录） */
  cwd: string;
  /** 标准输出内容（已截断） */
  stdout: string;
  /** 标准错误内容（已截断） */
  stderr: string;
  /** 进程退出码，0 表示成功 */
  exitCode: number;
  /** 命令执行耗时（毫秒） */
  duration: number;
  /** 是否因超时被强制终止 */
  timedOut: boolean;
}

/** 拒绝危险命令的简单黑名单（生产环境可考虑用 allow-list 替换） */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[a-zA-Z]*\s+)*-?[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\//, reason: 'rm -rf / 拒绝执行' },
  { pattern: /:\(\)\s*\{.*:\|:&.*\}\s*;:/, reason: 'fork 炸弹拒绝执行' },
  { pattern: /\bsudo\b/, reason: 'sudo 拒绝执行' },
  { pattern: /\bmkfs\b/, reason: 'mkfs 拒绝执行' },
  { pattern: /\bdd\s+if=/, reason: 'dd 写入设备拒绝执行' },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: '写入裸设备拒绝执行' },
  { pattern: /\bcurl\b.*\|\s*(ba)?sh\b/, reason: 'curl | sh 拒绝执行' },
];

/**
 * 命令安全检查：遍历危险命令黑名单进行正则匹配
 * @param command 待检查的 shell 命令
 * @throws 当命令命中任何危险模式时抛出错误
 */
function checkSafety(command: string): void {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`命令被安全策略拒绝：${reason}`);
    }
  }
}

/** 单个流最多保留的字符数（stdout/stderr 截断阈值） */
const TRUNCATE_LEN = 20_000;

/**
 * 截断超长输出，避免上下文被单条命令刷爆
 * @param s 原始输出字符串
 * @returns 截断后的字符串（带省略提示）
 */
function truncate(s: string): string {
  if (s.length <= TRUNCATE_LEN) return s;
  return s.slice(0, TRUNCATE_LEN) + `\n\n... [输出被截断，共 ${s.length} 字符]`;
}

/**
 * 执行 runCommand 工具的入口函数
 * 流程：安全检查 → 解析工作目录 → 设置超时 → 调用子进程 → 收集并截断输出
 * @param projectRoot 项目根目录（沙箱边界）
 * @param args 经 zod 校验的入参，包含 command 与可选 timeout
 * @returns 标准化执行结果（含退出码、耗时、是否超时等）
 */
export async function executeRunCommand(
  projectRoot: string,
  args: z.infer<typeof runCommandInputSchema>,
): Promise<RunCommandResult> {
  // 1) 先做安全检查，命中黑名单直接抛错
  checkSafety(args.command);
  // 2) 解析并校验工作目录，确保不会逃出 projectRoot
  const cwd = resolveSafePath(projectRoot, '.');

  // 3) 超时默认 15 秒
  const timeoutMs = args.timeout ?? 15_000;
  // 4) 记录开始时间用于统计耗时
  const start = Date.now();

  try {
    // 5) 真正调用 shell 执行命令
    const { stdout, stderr } = await execAsync(args.command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB 缓冲
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
    });

    // 6) 成功路径：返回 stdout/stderr 与元信息
    return {
      command: args.command,
      cwd: path.relative(path.resolve(projectRoot), cwd) || '.',
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      exitCode: 0,
      duration: Date.now() - start,
      timedOut: false,
    };
  } catch (err) {
    // 7) 失败/超时路径：从异常对象中尽量还原 stdout/stderr/退出码
    const e = err as {
      stdout?: string;
      stderr?: string;   
      code?: number;
      killed?: boolean;
      signal?: string;
      message?: string;
    };
    // 当进程被 kill 且信号为 SIGTERM 时，判定为超时
    const timedOut = e.killed === true && e.signal === 'SIGTERM';

    return {
      command: args.command,
      cwd: path.relative(path.resolve(projectRoot), cwd) || '.',
      stdout: truncate(e.stdout ?? ''),
      stderr: truncate(e.stderr ?? e.message ?? String(err)),
      exitCode: typeof e.code === 'number' ? e.code : 1,
      duration: Date.now() - start,
      timedOut,
    };
  }
}
