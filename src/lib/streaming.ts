/**
 * SSE (Server-Sent Events) 辅助工具
 *
 * 提供一个简单的编码器，把 StreamEvent 序列化为 SSE 文本帧。
 * 与 Vercel AI SDK 的 createDataStream / pipeDataStreamToResponse 配合使用。
 */

import type { StreamEvent } from '@/types';

/**
 * 把单个 StreamEvent 编码为 SSE 文本（多行 data:）。
 */
export function encodeSSE(event: StreamEvent): string {
  // 用 'data' 作为事件名（与设计文档一致）
  return `event: data\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * 用分块编码（chunked）写入单个事件到 WritableStreamDefaultWriter。
 */
export async function writeSSE(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  event: StreamEvent,
): Promise<void> {
  await writer.write(encoder.encode(encodeSSE(event)));
}
