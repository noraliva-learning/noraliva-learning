import Link from "next/link";

const DOMAINS = ["math", "reading", "writing", "architecture", "spanish"] as const;

export default function LivDomainsPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Liv — Choose a domain</h1>
      <ul style={{ marginTop: 16, lineHeight: 2 }}>
        {DOMAINS.map((d) => (
          <li key={d}>
            <Link href={`/learners/liv/domains/${d}`}>{d}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
