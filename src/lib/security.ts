/**
 * 路径安全工具
 *
 * 防止 Agent 通过相对路径（../）逃出项目根目录。
 * 所有涉及文件系统的工具都必须在执行前调用 resolveSafePath。
 */

import * as path from 'node:path';

/**
 * 将用户提供的相对/绝对路径解析为绝对路径，并校验它在 projectRoot 内。
 *
 * @throws 当解析后的路径不在 projectRoot 下时抛出 Error
 */
export function resolveSafePath(projectRoot: string, requested: string): string {
  // 1. 规范化 projectRoot（去除尾部斜杠，得到绝对路径）
  const absRoot = path.resolve(projectRoot);

  // 2. 解析请求路径：
  //    - 如果是绝对路径，直接 resolve
  //    - 如果是相对路径，相对于 projectRoot 解析
  let absTarget: string;
  if (path.isAbsolute(requested)) {
    absTarget = path.resolve(requested);
  } else {
    absTarget = path.resolve(absRoot, requested);
  }

  // 3. 校验：absTarget 必须以 absRoot 开头（用 separator 避免 /foo 匹配 /foobar）
  const rel = path.relative(absRoot, absTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `路径越界：拒绝访问 "${requested}"（解析后 "${absTarget}" 超出项目根 "${absRoot}"）`,
    );
  }

  return absTarget;
}

/**
 * 校验给定路径是否在 projectRoot 内（不抛错）。
 */
export function isPathSafe(projectRoot: string, requested: string): boolean {
  try {
    resolveSafePath(projectRoot, requested);
    return true;
  } catch {
    return false;
  }
}

/**
 * 把绝对路径转换为相对 projectRoot 的路径（用于 UI 展示）。
 */
export function toRelativePath(projectRoot: string, absPath: string): string {
  return path.relative(path.resolve(projectRoot), absPath);
}
