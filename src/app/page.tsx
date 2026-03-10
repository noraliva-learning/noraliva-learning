import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm p-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Liv &amp; Elle Learning Arcade
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Your place to practice math, reading, and more. Welcome, Liv and Elle!
        </p>

        <div className="mt-6">
          <Link
            href="/v2/login"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Sign in to Learning Arcade
          </Link>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to start practicing and see your progress.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-900">What you can practice</div>
            <div className="mt-2 text-sm text-slate-700">
              Math • Reading • Writing • Architecture • Spanish
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
