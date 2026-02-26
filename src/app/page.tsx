'use client';
import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-3xl border border-zinc-200 p-8 shadow-sm"
      >
        <h1 className="text-3xl font-bold tracking-tight">
          Liv &amp; Elle Learning Arcade
        </h1>
        <p className="mt-3 text-zinc-700">
          Phase 1 scaffold is live. Next: auth, profiles, mastery model,
          misconceptions, spaced repetition, games, and the parent dashboard.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-zinc-50 p-4">
            <div className="text-sm font-semibold">Learners</div>
            <div className="mt-1 text-sm text-zinc-700">
              Liv (7, Grade 2) • Elle (5, Grade 1)
            </div>
          </div>
          <div className="rounded-2xl bg-zinc-50 p-4">
            <div className="text-sm font-semibold">Domains</div>
            <div className="mt-1 text-sm text-zinc-700">
              Math • Reading • Writing • Architecture • Spanish
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
