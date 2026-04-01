export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });
  }

  const prompt = req.body?.prompt;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  const models = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-2.0-flash"];
  let lastError = "Model request failed";

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        lastError = `${model}: HTTP ${response.status} ${errText}`;
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = `${model}: empty response`;
        continue;
      }

      return res.status(200).json({ text: text.trim(), model });
    } catch (error) {
      lastError = `${model}: ${error.message}`;
    }
  }

  return res.status(502).json({
    error: "All Gemini model attempts failed",
    detail: lastError
  });
}
