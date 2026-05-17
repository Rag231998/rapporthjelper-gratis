function clean(v) {
  return typeof v === "string" ? v.trim() : "";
}

function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function trimKnowledge(text) {
  const t = clean(text);
  if (!t) return "";
  return t.slice(0, 18000);
}

function reportSummary(d) {
  d = d || {};
  const f = d.fields || {};
  const m = d.meta || {};

  return `
Løsning/kontekst: ${clean(m.solutionContext) || "ikke oppgitt"}
Kontaktperson: ${clean(m.contactName) || "ikke oppgitt"}
Oppdateringer avtalt med: ${clean(m.updatesAgreed) || "ikke oppgitt"}
Oppdateringsmerknad: ${clean(m.updatesNote)}
Utbedringer avtalt med: ${clean(m.fixesAgreed) || "ikke oppgitt"}
Utbedringsmerknad: ${clean(m.fixesNote)}

OPPSUMMERING:
${clean(f.summary)}

OPPDATERINGER:
${clean(f.updates)}

UTBEDRINGER:
${clean(f.fixes)}

OBSERVASJON:
${clean(f.observation)}

SJEKKLISTE:
${JSON.stringify(d.checklist || [])}

KONKLUSJON:
${clean(f.conclusion)}

KRITISKE TILTAK:
${JSON.stringify(d.critical || [])}

MULIGE KONSEKVENSER:
${clean(f.consequences)}

ANBEFALTE TILTAK:
${JSON.stringify(d.recommended || [])}
`;
}

function knowledgeBlock(d) {
  const k = trimKnowledge(d?.meta?.knowledgeText);
  if (!k) return "";
  return `
KUNNSKAPSGRUNNLAG:
Dette er generell bakgrunnstekst brukeren har lagt inn. Bruk dette til terminologi, generelle sjekkpunkter og forslag.
Ikke presenter informasjon fra kunnskapsgrunnlaget som observert hos kunde med mindre det også står i rapportfeltet.
Ikke lim inn lange utdrag. Ikke legg til kundespesifikke fakta som ikke står i rapporten.

${k}
`;
}

function baseRules() {
  return `
Du er en norsk rapportassistent for Ascom-teknikere som skriver kunderapport etter årlig kontroll.

Kontekst:
Ascom jobber med virksomhetskritisk kommunikasjon og løsninger som pasientvarsling, teleCARE IP/NISM, Telligence, Unite, AWA View, Myco, IP-DECT/DECT, VoWiFi, posisjonssendere/smykker, strømforsyning/UPS, fjerndrift, logger, backup, meldingsflyt, alarmflyt og Jira/saksoppfølging.

Regler:
- Skriv på norsk bokmål.
- Skriv kundevennlig, profesjonelt og nøkternt.
- Svar kun med ferdig tekst som kan stå direkte i rapportfeltet, med mindre oppgaven ber om kvalitetssjekk.
- Ikke skriv at du er AI.
- Ikke legg til fakta som ikke er oppgitt.
- Ikke finn på saksnummer, romnummer, datoer, målinger, tester eller navn.
- Ikke bruk navnet Kari. Hvis eksempelnavn trengs, bruk Nordmann.
- Behold tekniske navn som NISM, teleCARE IP, Telligence, Unite, AWA View, Myco, IP-DECT, DECT, VoWiFi, UPS og Jira.
- Unngå sensitive personopplysninger og helseopplysninger.
- Hvis videre oppfølging er relevant og Jira ikke er nevnt, skriv forsiktig at det bør vurderes om forholdet skal følges opp i Jira-sak.
- Ikke skriv at sak er opprettet hvis det ikke er oppgitt.
- Ikke overdriv alvorlighetsgrad.
- Ikke bruk pyntespråk.
- Vær konkret nok for kunde, men ikke unødvendig teknisk.
`;
}

function buildPrompt(data) {
  const mode = clean(data.mode);
  const title = clean(data.sectionTitle);
  const text = clean(data.sectionText);
  const report = reportSummary(data.reportData);
  const knowledge = knowledgeBlock(data.reportData);
  const rules = baseRules();

  if (mode === "rewrite") {
    return `${rules}

OPPGAVE:
Omformuler råteksten i feltet "${title}" til en ferdig rapporttekst.
Dette skal fungere som når brukeren skriver råtekst i ChatGPT og ber om bedre formulering.
Ikke ta med overskrift.
Ikke endre fakta.
Ikke legg til nye konkrete detaljer som ikke er oppgitt.
Bruk kunnskapsgrunnlag bare til språk, terminologi og generell presisjon.

RÅTEKST:
${text || "(tomt felt)"}

HELE RAPPORTEN SOM KONTEKST:
${report}

${knowledge}`;
  }

  if (mode === "append") {
    return `${rules}

OPPGAVE:
Les feltet "${title}", hele rapporten og eventuelt kunnskapsgrunnlag.
Lag 1-3 korte setninger som kan legges nederst i samme felt.
Dette er for knappen "Mangler jeg noe?".
Du skal vurdere om rapporten bør nevne:
- videre oppfølging
- Jira/saksoppfølging
- avklaring med kunde/IT
- dokumentasjon/systemtegning
- logger/backup/fjerndrift dersom det er naturlig
- anbefalt tiltak hvis teksten peker på avvik

Ikke gjenta det som allerede står.
Ikke finn på at noe er testet, utført eller opprettet.
Hvis det ikke er noe relevant å legge til, svar med tom tekst.

EKSISTERENDE TEKST:
${text || "(tomt felt)"}

HELE RAPPORTEN:
${report}

${knowledge}`;
  }

  if (mode === "check_comment") {
    return `${rules}

OPPGAVE:
Forbedre kommentaren til dette sjekklistepunktet.
Svar kun med én kort og kundevennlig kommentar som kan stå i kommentarfeltet.
Ikke ta med overskrift.

Sjekkpunkt: ${clean(data.checklistName)}
Status: ${clean(data.checklistStatus) || "ikke valgt"}
Kommentar:
${text || "(tom kommentar)"}

HELE RAPPORTEN:
${report}

${knowledge}`;
  }

  if (mode === "action") {
    return `${rules}

OPPGAVE:
Forbedre tiltaksteksten.
Svar kun med én ferdig tiltakstekst, uten nummer og uten overskrift.
Gjør teksten konkret, kundevennlig og handlingsrettet.
Ikke legg til nye fakta.

Felt: ${title}
Tekst:
${text || "(tomt felt)"}

HELE RAPPORTEN:
${report}

${knowledge}`;
  }

  if (mode === "fill_checklist") {
    return `${rules}

OPPGAVE:
Lag korte kommentarer til tomme sjekklistefelt der status er valgt.
Returner kun gyldig JSON-objekt.
Nøkkel skal være eksakt sjekklistepunkt, verdi skal være kort kommentar.
Ikke lag kommentar for punkter uten status.
Ikke finn på tekniske funn.

HELE RAPPORTEN:
${report}

${knowledge}`;
  }

  if (mode === "conclusion") {
    return `${rules}

OPPGAVE:
Lag en kort konklusjon basert på hele rapporten.
Svar kun med tekst til konklusjonsfeltet.
Konklusjonen skal oppsummere:
- om årlig kontroll er gjennomført
- generell status
- relevante avvik/observasjoner
- anbefalt videre oppfølging hvis relevant

Ikke legg til fakta.

HELE RAPPORTEN:
${report}

${knowledge}`;
  }

  if (mode === "suggest_recommended") {
    return `${rules}

OPPGAVE:
Foreslå 1-5 anbefalte tiltak basert på observasjon, sjekkliste, øvrig rapport og eventuelt kunnskapsgrunnlag.
Ikke finn på tekniske funn.
Tiltakene skal være forsiktige og relevante.
Returner nummerert liste uten overskrift.

HELE RAPPORTEN:
${report}

${knowledge}`;
  }

  if (mode === "quality") {
    return `${rules}

OPPGAVE:
Kvalitetssjekk rapporten før sending til kunde.
Svar med korte punkter:
- Hva bør forbedres
- Om noe bør avklares
- Om Jira/saksnummer/videre oppfølging bør nevnes
- Om konklusjonen henger sammen med observasjonen
- Om teksten virker kundevennlig og profesjonell
- Om noe fra kunnskapsgrunnlaget kan gi relevante generelle sjekkpunkter

Ikke skriv om hele rapporten.

HELE RAPPORTEN:
${report}

${knowledge}`;
  }

  return `${rules}\n\nSkriv rapporttekst basert på:\n${report}\n${knowledge}`;
}

function extractOpenAIText(result) {
  if (typeof result.output_text === "string") return result.output_text;
  if (Array.isArray(result.output)) {
    const parts = [];
    for (const item of result.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c.text === "string") parts.push(c.text);
          if (typeof c.content === "string") parts.push(c.content);
        }
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

async function callOpenAI(data) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: "Du skriver presise, faktabaserte og kundevennlige norske rapporttekster for tekniske kontroller.",
      input: buildPrompt(data),
      temperature: 0.2,
      max_output_tokens: data.mode === "quality" ? 900 : 700
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: result?.error?.message || result?.message || `Feil fra OpenAI. HTTP ${response.status}`
    };
  }

  return { ok: true, text: extractOpenAIText(result) };
}

async function callGitHubModels(data) {
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
        { role: "system", content: "Du skriver presise, faktabaserte og kundevennlige norske rapporttekster for tekniske kontroller." },
        { role: "user", content: buildPrompt(data) }
      ],
      temperature: 0.2,
      max_tokens: data.mode === "quality" ? 900 : 700
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: result?.message || result?.error?.message || `Feil fra GitHub Models. HTTP ${response.status}`
    };
  }

  return { ok: true, text: result?.choices?.[0]?.message?.content || "" };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Kun POST er støttet." });
  }

  try {
    const data = parseBody(req);
    let result;
    let provider = "";

    if (process.env.OPENAI_API_KEY) {
      provider = "OpenAI";
      result = await callOpenAI(data);
    } else if (process.env.GITHUB_TOKEN) {
      provider = "GitHub Models";
      result = await callGitHubModels(data);
    } else {
      return res.status(500).json({
        error: "Mangler API-nøkkel. Legg inn OPENAI_API_KEY i Vercel Environment Variables. Alternativt kan GITHUB_TOKEN brukes som fallback."
      });
    }

    if (!result.ok) {
      return res.status(result.status || 500).json({ error: `${provider}: ${result.error}` });
    }

    const content = (result.text || "").trim();

    if (data.mode === "fill_checklist") {
      try {
        const cleaned = content.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
        return res.status(200).json({ comments: JSON.parse(cleaned), provider });
      } catch {
        return res.status(200).json({ comments: {}, text: content, provider });
      }
    }

    return res.status(200).json({ text: content, provider });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Ukjent feil." });
  }
};
