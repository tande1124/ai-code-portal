'use client';

/**
 * "思考中"动画：三圆点交错呼吸。
 */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2" aria-label="思考中">
      <span className="h-1.5 w-1.5 rounded-full bg-fg-secondary animate-pulse-dot" />
      <span
        className="h-1.5 w-1.5 rounded-full bg-fg-secondary animate-pulse-dot"
        style={{ animationDelay: '0.2s' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-fg-secondary animate-pulse-dot"
        style={{ animationDelay: '0.4s' }}
      />
    </div>
  );
}
