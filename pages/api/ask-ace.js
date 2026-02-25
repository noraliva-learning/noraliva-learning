
export default async function handler(req, res) {
  const { question } = req.body;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      input: `
You are Ace, a learning companion for children.
Respond at:
- Grade 2 level for Liv
- Grade 1 level for Elle
Be warm, short, and curious.
Question: ${question}
`
    })
  });

  const data = await response.json();
  res.json({ answer: data.output?.[0]?.content?.[0]?.text || "Let's think about that together!" });
}
