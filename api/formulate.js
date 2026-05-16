function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function body(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function styleText(style) {
  if (style === "kort") return "Skriv kort, presist og rapportvennlig.";
  if (style === "teknisk") return "Skriv mer teknisk, men fortsatt forståelig for kunde.";
  return "Skriv kundevennlig, profesjonelt og tydelig.";
}

function productContext(system) {
  const s = clean(system).toLowerCase();

  if (s.includes("telecare") || s.includes("nism")) {
    return "Kontekst: TelecareIP/NISM er pasientvarslingssystem. Relevante temaer kan være NISM GUI, logger, rom/enheter, smykker, posisjon, alarmflyt, backup, fjerntilgang og Jira-saker ved avvik.";
  }

  if (s.includes("awa")) {
    return "Kontekst: AWA View handler om visning/status og alarmflyt. Relevante temaer kan være oppdatering i visning, mottakergrupper, tjenester, alarmrespons og funksjonstest.";
  }

  if (s.includes("unite")) {
    return "Kontekst: Unite brukes til meldingsflyt/alarmhåndtering. Relevante temaer kan være distribusjonslogg, meldingsruting, integrasjoner, nettverk og mottak på enheter.";
  }

  if (s.includes("dect")) {
    return "Kontekst: IP-DECT/DECT gjelder telefoni og trådløs kommunikasjon. Relevante temaer kan være registrering, dekning, basestasjoner, inn/utgående tale og stabilitet.";
  }

  if (s.includes("myco")) {
    return "Kontekst: Myco er mobile enheter brukt for varsling/kommunikasjon. Relevante temaer kan være mottak av varsel, batteri/lading, defekte enheter og logistikk/reparasjon.";
  }

  if (s.includes("posisjon") || s.includes("smykker")) {
    return "Kontekst: Posisjonssendere/smykker gjelder beboerutstyr, lokasjon og varsling. Relevante temaer kan være offline/aktive enheter, batteri, test av lokasjon og videre tiltak.";
  }

  if (s.includes("strøm") || s.includes("ups")) {
    return "Kontekst: Strømforsyning/UPS gjelder driftssikkerhet. Relevante temaer kan være strømtilførsel, UPS-status, strømbruddsalarm, defekt strømforsyning og behov for bytte.";
  }

  if (s.includes("fjerndrift")) {
    return "Kontekst: Fjerndrift/tilgang gjelder mulighet for remote kontroll og feilsøking. Relevante temaer kan være VPN, AD/SSO, kunde-IT, begrensninger og oppfølging.";
  }

  if (s.includes("jira")) {
    return "Kontekst: Jira/saksoppfølging gjelder dokumentasjon av avvik, videre tiltak, status og ansvar.";
  }

  return "Kontekst: Ascom leverer løsninger for kritisk kommunikasjon, pasientvarsling, alarmflyt, mobile enheter og arbeidsflyt. Skriv presist og ikke finn på detaljer.";
}

function buildPrompt(data) {
  const mode = clean(data.mode);
  const sectionTitle = clean(data.sectionTitle);
  const sectionText = clean(data.sectionText);
  const system = clean(data.system);
  const area = clean(data.area);
  const status = clean(data.status);
  const contact = clean(data.contact);

  const commonRules = `
Du skriver norsk bokmål for en kunderapport etter årlig kontroll.
${styleText(data.style)}
Ikke skriv at du er AI.
Ikke legg til fakta som ikke finnes i teksten.
Ikke finn på romnummer, saksnummer, tester, datoer eller navn.
Behold tekniske navn som NISM, AWA View, Unite, Myco, IP-DECT, Jira, romnummer og saksnummer.
Unngå sensitive personopplysninger og helseopplysninger.
Rett skrivefeil og gjør teksten trygg å sende til kunde.
${productContext(system)}

KONTEKST:
Rapportfelt: ${sectionTitle}
Kontaktperson: ${contact || "ikke oppgitt"}
System/produkt: ${system || "ikke valgt"}
Område: ${area || "ikke valgt"}
Status: ${status || "ikke valgt"}
`;

  if (mode === "missing") {
    return `${commonRules}

OPPGAVE:
Se på teksten i dette rapportfeltet og foreslå 3-6 korte punkter teknikeren bør vurdere å nevne hvis det er relevant.
Dette skal være en sjekkliste, ikke ferdig rapporttekst.
Ikke påstå at noe er glemt. Skriv "Vurder å nevne..." eller "Sjekk om..."
Ta gjerne med forslag om Jira/saksnummer, videre tiltak, kunde informert, test utført/ikke utført, logger, backup, fjerntilgang eller avvik dersom relevant.

TEKST I FELTET:
${sectionText || "(feltet er tomt)"}

Svar kun med punktliste.`;
  }

  return `${commonRules}

OPPGAVE:
Omformuler teksten slik at den kan limes direkte inn i feltet "${sectionTitle}".
Svar kun med ferdig rapporttekst for dette feltet. Ikke ta med overskrift.
Hvis teksten er tom, lag en forsiktig standardformulering basert på valgt system, område og status. Ikke påstå konkrete tester hvis de ikke er oppgitt.

RÅTEKST:
${sectionText || "(feltet er tomt)"}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Kun POST er støttet." });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: "GITHUB_TOKEN mangler i Vercel Environment Variables." });
  }

  try {
    const data = body(req);
    const prompt = buildPrompt(data);
    const model = process.env.GITHUB_MODEL || "openai/gpt-4.1-mini";

    const response = await fetch("https://models.github.ai/inference/chat/completions", {
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
            content: "Du er en presis norsk rapportassistent for teknikere som skriver kunderapport etter årlig kontroll. Du er faktabasert, nøktern og kundevennlig."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: data.mode === "missing" ? 500 : 750
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: result?.message || result?.error?.message || `Feil fra GitHub Models. HTTP ${response.status}`
      });
    }

    const text = result?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text: text.trim() || "Ingen tekst ble generert." });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Ukjent feil." });
  }
};
