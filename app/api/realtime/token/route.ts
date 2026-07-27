const REALTIME_MODEL = "gpt-realtime-2.1-mini";
const SAFETY_IDENTIFIER = "fe818e9ff0d75debc771813ba5335ef4b274d2a6d6430dca9664658e30248f3";

type ClientSecretResponse = {
  value?: string;
  expires_at?: number;
  error?: { message?: string };
};

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Le coach vocal n’est pas activé." }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "OpenAI-Safety-Identifier": SAFETY_IDENTIFIER,
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          audio: { output: { voice: "marin" } },
        },
      }),
    });
    const payload = await response.json() as ClientSecretResponse;
    if (!response.ok || !payload.value) {
      return Response.json(
        { error: payload.error?.message ?? "Impossible de démarrer le coach vocal." },
        { status: 502 },
      );
    }

    return Response.json(
      { value: payload.value, expiresAt: payload.expires_at },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch {
    return Response.json({ error: "Le service vocal est momentanément indisponible." }, { status: 503 });
  }
}
