import Link from "next/link";

const DOMAINS = [
  { id: "math", label: "Math" },
  { id: "reading", label: "Reading" },
  { id: "writing", label: "Writing" },
  { id: "architecture", label: "Architecture" },
  { id: "spanish", label: "Spanish" },
];

export default function DomainsPage({
  params,
}: {
  params: { learnerId: string };
}) {
  const learnerId = params.learnerId;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold capitalize">{learnerId}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Select a domain to begin.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {DOMAINS.map((d) => (
          <Link
            key={d.id}
            href={`/learners/${learnerId}/domains/${d.id}`}
            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow"
          >
            <div className="text-lg font-semibold">{d.label}</div>
            <div className="mt-1 text-sm text-neutral-600">
              Start a short session
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <Link href={`/`} className="text-sm underline">
          ← Back home
        </Link>
      </div>
    </main>
  );
}
