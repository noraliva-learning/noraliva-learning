'use client';

type AceMessageProps = {
  from: 'ace' | 'learner';
  text: string;
  helperName: string;
};

export function AceMessage({ from, text, helperName }: AceMessageProps) {
  const isAce = from === 'ace';
  return (
    <div
      className={`flex ${isAce ? 'justify-start' : 'justify-end'} text-sm text-[rgb(var(--learner-text))]`}
    >
      <div
        className={`max-w-[260px] rounded-2xl px-3 py-2 shadow-sm ${
          isAce
            ? 'bg-[rgb(var(--learner-panel))] border border-[rgb(var(--learner-border))]'
            : 'bg-[rgb(var(--learner-success))] border border-[rgb(var(--learner-success-strong))]'
        }`}
      >
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--learner-text-muted))]">
          {isAce ? helperName : 'You'}
        </p>
        <p className="whitespace-pre-wrap leading-snug">{text}</p>
      </div>
    </div>
  );
}

