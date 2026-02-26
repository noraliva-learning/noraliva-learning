import Link from "next/link";

export default function LearnerPage({
  params,
}: {
  params: { learnerId: string };
}) {
  const learnerId = params.learnerId;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold capitalize">{learnerId}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Learner page is live. Next: lesson path + domains.
      </p>

      <div className="mt-6">
        <Link
          href={`/learners/${learnerId}/domains`}
          className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Choose a domain →
        </Link>
      </div>
    </main>
  );
}
