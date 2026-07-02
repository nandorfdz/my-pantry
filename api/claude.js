// Vercel Serverless Function — corre en el servidor, nunca en el navegador.
// Mantiene tu ANTHROPIC_API_KEY fuera del cliente.
//
// Configura la variable de entorno ANTHROPIC_API_KEY en Vercel
// (Project Settings → Environment Variables) o en un archivo .env local
// si usas "vercel dev".

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Falta configurar ANTHROPIC_API_KEY en el servidor. Revisa el README.",
    });
    return;
  }

  try {
    const { content, maxTokens } = req.body || {};
    if (!content) {
      res.status(400).json({ error: "Falta el contenido del mensaje." });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens || 1500,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({
        error: (data && data.error && data.error.message) || "Error de la API de Anthropic",
      });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Error inesperado en el servidor." });
  }
}
