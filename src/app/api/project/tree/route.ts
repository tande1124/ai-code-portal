/**
 * GET /api/project/tree?path=...
 *
 * 返回项目目录树（供 FileTree 侧边栏使用）。
 * 这是设计文档主路由之外的辅助端点，不参与 Agent 循环。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isPathSafe } from '@/lib/security';
import { executeListDir } from '@/lib/tools/listDir';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const projectPath = url.searchParams.get('path');
  if (!projectPath) {
    return NextResponse.json({ error: '缺少 path 参数' }, { status: 400 });
  }
  if (!isPathSafe(projectPath, '.')) {
    return NextResponse.json({ error: `path 不合法：${projectPath}` }, { status: 400 });
  }

  try {
    const tree = await executeListDir(projectPath, { path: '.', depth: 3 });
    return NextResponse.json({ tree });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
