import { useRouter } from "next/router";
import { useState } from "react";

export default function Learn() {
  const router = useRouter();
  const { kid, domain } = router.query;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAce() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");

    try {
      const res = await fetch("/api/ask-ace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kid, domain, question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setAnswer(data.answer || "");
    } catch (e) {
      setAnswer(`Oops — I hit an error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "80px auto", textAlign: "center" }}>
      <h2>
        {kid ? `Learning: ${kid}` : "Learning"} {domain ? `• ${domain}` : ""}
      </h2>

      <div style={{ marginTop: 18 }}>
        <button onClick={() => router.push("/")}>⬅ Back</button>
      </div>

      <div style={{ marginTop: 28 }}>
        <p style={{ marginBottom: 8 }}>Ask Ace a question:</p>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question…"
          style={{ width: "90%", padding: 10 }}
        />
        <div style={{ marginTop: 12 }}>
          <button onClick={askAce} disabled={loading}>
            {loading ? "Thinking…" : "Ask Ace"}
          </button>
        </div>
      </div>

      {answer && (
        <div
          style={{
            marginTop: 24,
            textAlign: "left",
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {answer}
        </div>
      )}
    </div>
  );
}
