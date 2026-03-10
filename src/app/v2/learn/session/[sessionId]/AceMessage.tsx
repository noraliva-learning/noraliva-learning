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
      className={`flex ${isAce ? 'justify-start' : 'justify-end'} text-sm text-slate-800`}
    >
      <div
        className={`max-w-[260px] rounded-2xl px-3 py-2 shadow-sm ${
          isAce
            ? 'bg-sky-50 border border-sky-100'
            : 'bg-emerald-50 border border-emerald-100'
        }`}
      >
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {isAce ? helperName : 'You'}
        </p>
        <p className="whitespace-pre-wrap leading-snug">{text}</p>
      </div>
    </div>
  );
}

