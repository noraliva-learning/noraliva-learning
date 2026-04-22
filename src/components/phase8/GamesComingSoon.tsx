/**
 * Placeholder game cards — foundation for future Math / Spanish games.
 */
export function GamesComingSoon() {
  const games = [
    { title: 'Math Game', emoji: '🔢', href: null as string | null },
    { title: 'Spanish Game', emoji: '🇪🇸', href: null as string | null },
  ];

  return (
    <section className="mt-10" data-testid="games-section">
      <h2 className="text-lg font-bold text-[rgb(var(--learner-text))]">Games</h2>
      <p className="mt-1 text-sm text-[rgb(var(--learner-text-muted))]">More fun is on the way.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {games.map((g) => (
          <div
            key={g.title}
            className="rounded-2xl border-2 border-dashed border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))]/80 p-5 text-center opacity-90"
          >
            <div className="text-4xl">{g.emoji}</div>
            <p className="mt-2 font-semibold text-[rgb(var(--learner-text))]">{g.title}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[rgb(var(--learner-text-muted))]">
              Coming soon
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
