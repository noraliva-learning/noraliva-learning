import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm p-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Liv &amp; Elle Learning Arcade
        </h1>
        <p className="mt-2 text-slate-600">
          Phase 1 scaffold is live. Next: auth, profiles, mastery model,
          misconceptions, spaced repetition, games, and the parent dashboard.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-900">Learners</div>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/learners/liv"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-white text-sm font-semibold hover:opacity-90"
              >
                Start Liv
              </Link>
              <Link
                href="/learners/elle"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-white text-sm font-semibold hover:opacity-90"
              >
                Start Elle
              </Link>
            </div>
            <div className="mt-3 text-xs text-slate-600">
              Liv (7, Grade 2) • Elle (5, Grade 1)
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-900">Domains</div>
            <div className="mt-2 text-sm text-slate-700">
              Math • Reading • Writing • Architecture • Spanish
            </div>
            <div className="mt-3 text-xs text-slate-600">
              (We’ll make these clickable after learner selection.)
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
