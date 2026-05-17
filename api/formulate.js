function clean(v) {
  return typeof v === "string" ? v.trim() : "";
}

function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function styleInstruction(style) {
  if (style === "kort") return "Skriv kort, presist og uten unødvendig fylltekst.";
  if (style === "teknisk") return "Skriv mer teknisk, men fortsatt forståelig for kunde.";
  if (style === "tydelig") return "Skriv tydelig med vekt på anbefalt tiltak, ansvar og videre oppfølging.";
  return "Skriv kundevennlig, profesjonelt og nøkternt.";
}

function ascomContext(system) {
  const s = clean(system).toLowerCase();

  const base = [
    "Ascom leverer løsninger for virksomhetskritisk kommunikasjon, Healthcare ICT, pasientvarsling, alarmhåndtering, mobile enheter, meldingsflyt og arbeidsflyt i tidssensitive miljøer.",
    "Rapporten skal være egnet for kunde og skal ikke overdrive, spekulere eller legge til fakta som ikke er oppgitt."
  ];

  if (s.includes("telecare") || s.includes("nism") || s.includes("pasientvarsling")) {
    base.push("Relevant kontekst: teleCARE IP/NISM, pasientvarsling, sentrale moduler, rom/enheter, smykker, posisjon, alarmflyt, logger, backup, fjerndrift og Jira ved videre oppfølging.");
  }
  if (s.includes("telligence")) {
    base.push("Relevant kontekst: Telligence, pasientvarsling, alarmflyt, rom/enheter og funksjonstest.");
  }
  if (s.includes("unite")) {
    base.push("Relevant kontekst: Unite, meldingsruting, alarmhåndtering, distribusjonslogg, integrasjoner, mobile enheter og server/plattform.");
  }
  if (s.includes("awa")) {
    base.push("Relevant kontekst: AWA View, visning, alarmflyt, mottakergrupper og oppdatering av statusbilde.");
  }
  if (s.includes("myco")) {
    base.push("Relevant kontekst: Myco, mobile enheter, mottak av varsler, batteri/lading, stikkprøve og eventuell reparasjon/logistikk.");
  }
  if (s.includes("dect") || s.includes("vowifi")) {
    base.push("Relevant kontekst: trådløs telefoni, basestasjoner, dekning, registrering og inn-/utgående tale.");
  }
  if (s.includes("posisjon") || s.includes("smykker")) {
    base.push("Relevant kontekst: posisjonssendere/smykker, offline/aktive enheter, lokasjon, batteristatus og videre tiltak.");
  }
  if (s.includes("strøm") || s.includes("ups")) {
    base.push("Relevant kontekst: strømforsyning, UPS, driftssikkerhet, strømbruddsalarm og behov for bytte ved defekt.");
  }
  if (s.includes("fjerndrift")) {
    base.push("Relevant kontekst: fjerntilgang, VPN/portal, kundens IT, tilgangsbegrensninger og konsekvens for kontroll/feilsøking.");
  }
  if (s.includes("jira")) {
    base.push("Relevant kontekst: Jira/saksoppfølging, saksnummer, videre tiltak, ansvar og kundens beslutning.");
  }

  return base.join("\n");
}

function reportSummary(reportData) {
  const d = reportData || {};
  const c = d.context || {};
  const f = d.fields || {};

  return `
KONTEKSTVALG
System/produkt: ${clean(c.system)}
Kontrollpunkt: ${clean(c.controlPoint)}
Status: ${clean(c.statusChoice)}
Stil: ${clean(c.styleChoice)}
Kontaktperson: ${clean(c.contactName) || "ikke oppgitt"}
Oppdateringer avtalt med: ${clean(c.updatesAgreed) || "ikke oppgitt"}
Utbedringer avtalt med: ${clean(c.fixesAgreed) || "ikke oppgitt"}
Oppfølging: ${clean(c.followUp) || "ikke valgt"}

RAPPORTFELT
Oppsummering: ${clean(f.summary)}
Oppdateringer: ${clean(f.updates)}
Utbedringer: ${clean(f.fixes)}
Observasjon: ${clean(f.observation)}
Konklusjon: ${clean(f.conclusion)}
Mulige konsekvenser: ${clean(f.consequences)}

Kritiske tiltak: ${JSON.stringify(d.critical || [])}
Anbefalte tiltak: ${JSON.stringify(d.recommended || [])}
Sjekkliste: ${JSON.stringify(d.checklist || [])}
`;
}

function baseRules(reportData) {
  const c = (reportData || {}).context || {};
  return `
Du er en norsk rapportassistent for Ascom-teknikere som skriver kunderapport etter årlig kontroll.
${styleInstruction(c.styleChoice)}
Skriv på norsk bokmål.
Ikke skriv at du er AI.
Ikke legg til fakta som ikke er oppgitt.
Ikke finn på romnummer, saksnummer, dato, målinger, tester eller navn.
Bruk "kunde", "anlegget", "systemet" eller "kontaktperson" der det passer.
Ikke bruk navnet Kari. Dersom eksempelnavn trengs, bruk Nordmann.
Behold tekniske navn som NISM, teleCARE IP, Telligence, Unite, AWA View, Myco, IP-DECT, DECT, VoWiFi, UPS, Jira, romnummer og saksnummer.
Unngå sensitive personopplysninger og helseopplysninger.
Hvis Jira ikke er nevnt, men videre oppfølging er relevant, formuler forsiktig: "Det bør vurderes om forholdet skal følges opp i Jira-sak" - ikke skriv at sak er opprettet.
Hvis kunde må ta stilling til tiltak, formuler det tydelig uten å legge skyld på kunde.
${ascomContext(c.system)}
`;
}

function buildPrompt(data) {
  const mode = clean(data.mode);
  const reportData = data.reportData || {};
  const title = clean(data.sectionTitle);
  const text = clean(data.sectionText);
  const rules = baseRules(reportData);
  const summary = reportSummary(reportData);

  if (mode === "rewrite_field") {
    return `${rules}

OPPGAVE:
Omformuler kun dette rapportfeltet slik at det kan limes direkte inn i feltet "${title}".
Ikke ta med overskrift.
Ikke endre fakta.
Gjør teksten bedre, roligere, mer profesjonell og egnet for kunde.

RAPPORTKONTEKST:
${summary}

RÅTEKST I FELTET:
${text || "(tomt felt)"}`;
  }

  if (mode === "append_missing") {
    return `${rules}

OPPGAVE:
Du skal lage tekst som automatisk kan legges til nederst i rapportfeltet "${title}".
Teksten skal IKKE gjenta det som allerede står.
Den skal kun dekke viktige ting som bør vurderes, basert på rapportmalen og konteksten.

Viktig:
- Ikke skriv "mangler" eller "du har glemt".
- Ikke finn på at Jira-sak er opprettet.
- Hvis Jira/saksoppfølging ikke er nevnt og oppfølging kan være relevant, legg til en forsiktig setning om at det bør vurderes om forholdet skal følges opp i Jira-sak.
- Hvis kunde bør informeres/avklare tiltak, skriv det forsiktig.
- Hvis feltet allerede er godt nok, svar med tom streng.

Svar som 1-3 korte setninger eller korte punktlinjer som kan limes direkte inn i feltet.

RAPPORTKONTEKST:
${summary}

EKSISTERENDE TEKST I FELTET:
${text || "(tomt felt)"}`;
  }

  if (mode === "make_conclusion") {
    return `${rules}

OPPGAVE:
Lag en kort og solid konklusjon fra rapporten.
Konklusjonen skal passe i feltet KONKLUSJON.
Ikke ta med overskrift.
Ikke legg til fakta.
Nevn om årlig kontroll er gjennomført, generell status, eventuelle avvik/tiltak og videre oppfølging hvis relevant.

RAPPORT:
${summary}`;
  }

  if (mode === "polish_critical" || mode === "polish_recommended") {
    return `${rules}

OPPGAVE:
Forbedre tiltakstekstene under. Returner maks 5 nummererte linjer.
Ikke legg til nye tiltak som ikke finnes i teksten.
Gjør hvert tiltak konkret, kundevennlig og handlingsrettet.

RAPPORT:
${summary}

TILTAK:
${clean(data.sectionText)}`;
  }

  if (mode === "suggest_recommended") {
    return `${rules}

OPPGAVE:
Foreslå 1-5 anbefalte tiltak basert på observasjon, utbedringer, konklusjon og sjekkliste.
Ikke finn på tekniske funn. Bruk bare tiltak som følger naturlig av det som er skrevet.
Hvis det er lite informasjon, gi generelle og forsiktige anbefalinger.
Returner nummerert liste uten overskrift.

RAPPORT:
${summary}`;
  }

  if (mode === "checklist_comments") {
    return `${rules}

OPPGAVE:
Lag korte kommentarer til sjekklistepunkter som mangler kommentar, basert på status og rapporttekst.
Returner gyldig JSON-objekt der nøkkel er eksakt sjekklistepunkt og verdi er kommentar.
Kommentar skal være kort og egnet for kunde.
Ikke lag kommentar for punkter der status er tom, med mindre rapporten tydelig omtaler punktet.

RAPPORT:
${summary}

SJEKKLISTEPUNKTER:
${JSON.stringify(data.checklistItems || [])}`;
  }

  if (mode === "full_review") {
    return `${rules}

OPPGAVE:
Kvalitetssjekk rapporten før den sendes til kunde.
Svar med korte punkter:
1. Hva bør forbedres før sending
2. Mulige manglende avklaringer
3. Om Jira/saksnummer/videre tiltak bør nevnes
4. Om konklusjonen henger sammen med observasjonene
Ikke skriv om rapporten. Gi kun sjekkpunkter.

RAPPORT:
${summary}`;
  }

  return `${rules}

OPPGAVE:
Skriv en kundevennlig rapporttekst basert på dette:
${summary}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Kun POST er støttet." });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: "GITHUB_TOKEN mangler i Vercel Environment Variables." });
  }

  try {
    const data = parseBody(req);
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
            content: "Du skriver presise, nøkterne og kundevennlige norske rapporttekster for tekniske kontroller. Du er faktabasert og legger ikke til opplysninger som ikke finnes i grunnlaget."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: data.mode === "full_review" ? 900 : 750
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: result?.message || result?.error?.message || `Feil fra GitHub Models. HTTP ${response.status}`
      });
    }

    const content = result?.choices?.[0]?.message?.content || "";

    if (data.mode === "checklist_comments") {
      try {
        const cleaned = content.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
        const comments = JSON.parse(cleaned);
        return res.status(200).json({ comments });
      } catch {
        return res.status(200).json({ comments: {}, text: content.trim() });
      }
    }

    return res.status(200).json({ text: content.trim() });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Ukjent feil." });
  }
};
