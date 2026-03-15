'use client';

import type { WorkmatTool } from '@/lib/workmat/workmat-schema';

type Props = {
  currentTool: WorkmatTool;
  onToolChange: (tool: WorkmatTool) => void;
  onClear: () => void;
  disabled?: boolean;
};

const TOOLS: { id: WorkmatTool; label: string; icon: string }[] = [
  { id: 'pen', label: 'Pen', icon: '✏️' },
  { id: 'highlighter', label: 'Highlighter', icon: '🖍️' },
  { id: 'eraser', label: 'Eraser', icon: '🧹' },
  { id: 'pointer', label: 'Select', icon: '👆' },
  { id: 'line', label: 'Connect', icon: '➖' },
  { id: 'circle', label: 'Circle', icon: '⭕' },
];

export function WorkMatToolbar({ currentTool, onToolChange, onClear, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-panel))] p-2">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          aria-label={t.label}
          disabled={disabled}
          onClick={() => onToolChange(t.id)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors ${
            currentTool === t.id
              ? 'bg-[rgb(var(--learner-cta))] text-[rgb(var(--learner-cta-text))]'
              : 'bg-[rgb(var(--learner-surface))] text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]'
          }`}
        >
          {t.icon}
        </button>
      ))}
      <button
        type="button"
        title="Clear"
        aria-label="Clear canvas"
        disabled={disabled}
        onClick={onClear}
        className="ml-2 flex h-9 items-center rounded-lg border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-surface))] px-3 text-sm font-medium text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]"
      >
        Clear
      </button>
    </div>
  );
}
