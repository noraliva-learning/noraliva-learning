import Link from "next/link";

const DOMAINS = ["math", "reading", "writing", "architecture", "spanish"] as const;

export default function ElleDomainsPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Elle — Choose a domain</h1>
      <ul style={{ marginTop: 16, lineHeight: 2 }}>
        {DOMAINS.map((d) => (
          <li key={d}>
            <Link href={`/learners/elle/domains/${d}`}>{d}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
