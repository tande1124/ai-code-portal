'use client';

import { useState, type FormEvent } from 'react';

interface ProjectSelectorProps {
  projectPath: string | null;
  onOpen: (path: string) => void;
  disabled?: boolean;
}

export function ProjectSelector({
  projectPath,
  onOpen,
  disabled = false,
}: ProjectSelectorProps) {
  const [input, setInput] = useState(projectPath ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('请输入项目路径');
      return;
    }
    setError(null);
    onOpen(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="/Users/yourname/projects/my-app"
        disabled={disabled}
        className="flex-1 min-w-0 bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-accent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="shrink-0 px-3 py-1.5 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        打开
      </button>
      {error && <span className="text-xs text-accent-danger">{error}</span>}
    </form>
  );
}
