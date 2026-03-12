'use client';

type AceInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  helperName: string;
};

export function AceInput({ value, onChange, onSend, disabled, helperName }: AceInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !disabled) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={`Ask ${helperName} for a hint or explanation…`}
        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-50"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="self-end rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
      >
        {disabled ? `${helperName} is thinking…` : `Ask ${helperName}`}
      </button>
    </div>
  );
}

