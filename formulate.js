function styleInstruction(style) {
  if (style === "kort") return "Skriv kort og presist, men behold viktige fakta.";
  if (style === "teknisk") return "Skriv som en teknisk rapport til kunde. Bruk faglig presist språk, men hold det forståelig.";
  return "Skriv kundevennlig, profesjonelt, rolig og tydelig.";
}

function buildPrompt(data) {
  const rules = [
    styleInstruction(data.style),
    data.noNewFacts ? "Ikke legg til informasjon som ikke står i rapportgrunnlaget." : "",
    data.fixLanguage ? "Rett skrivefeil, grammatikk og uklare setninger." : "",
    data.mergeRepeats ? "Samle gjentakelser og gjør strukturen ryddig." : "",
    data.keepHeadings ? "Bruk overskriftene: OPPSUMMERING FRA KUNDESAMTALE, OPPDATERINGER OG OPPGRADERINGER, UTBEDRINGER OG ENDRINGER, OBSERVASJONER, KONKLUSJON." : "",
    "Skriv på norsk bokmål.",
    "Ikke skriv forklaring før eller etter rapporten.",
    "Ikke si at du er en AI.",
    "Behold relevante saksnummer, romnummer, systemnavn og tekniske detaljer."
  ].filter(Boolean).join("\n");

  return `${rules}

RAPPORTGRUNNLAG

Kundesamtale med:
${data.contact || "Ikke oppgitt"}

System / område:
${data.system || "Ikke oppgitt"}

Oppsummering fra kundesamtale:
${data.summary || "Ikke oppgitt"}

Oppdateringer og oppgraderinger:
${data.updates || "Ikke oppgitt"}

Utbedringer og endringer:
${data.fixes || "Ikke oppgitt"}

Observasjoner:
${data.observations || "Ikke oppgitt"}

Konklusjon / notater:
${data.conclusion || "Ikke oppgitt"}

Saker / referanser:
${data.tickets || "Ikke oppgitt"}
`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Kun POST er støttet." });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({
      error: "GITHUB_TOKEN mangler i Vercel Environment Variables."
    });
  }

  try {
    const data = req.body || {};
    const rawText = [data.summary, data.updates, data.fixes, data.observations, data.conclusion]
      .filter(Boolean)
      .join("\n");

    if (!rawText.trim()) {
      return res.status(400).json({ error: "Ingen rapporttekst mottatt." });
    }

    if (rawText.length > 12000) {
      return res.status(400).json({ error: "Teksten er for lang. Forkort teksten og prøv igjen." });
    }

    const model = process.env.GITHUB_MODEL || "openai/gpt-4.1-mini";
    const prompt = buildPrompt(data);

    const ghResponse = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Du hjelper teknikere med å skrive kundevennlige tekniske rapporter. Du skal være presis, faktabasert og ikke finne på detaljer."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1800
      })
    });

    const result = await ghResponse.json();

    if (!ghResponse.ok) {
      return res.status(ghResponse.status).json({
        error: result?.message || result?.error?.message || "Feil fra GitHub Models."
      });
    }

    const text = result?.choices?.[0]?.message?.content || "Ingen tekst ble generert.";
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Ukjent feil ved formulering."
    });
  }
}
