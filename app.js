const $ = (id) => document.getElementById(id);

const textFields = ["summary", "updates", "fixes", "observation", "conclusion"];
const allFields = ["contact", "system", "area", "status", "style", ...textFields, "noNewFacts", "keepTechnical", "noSensitive"];
const STORAGE_KEY = "rapporthjelper-arlig-kontroll-v2";
let activeTextareaId = "summary";
const previousValues = {};

const suggestionMap = {
  "TelecareIP / NISM (pasientvarsling)|Logg / hendelseslogg": [
    "Logger i NISM er kontrollert.",
    "Det er ikke observert kritiske loggfeil som tilsier påvirkning på normal drift.",
    "Eventuelle eldre loggmeldinger vurderes ikke å ha driftsmessig betydning på kontrolltidspunktet.",
    "Videre oppfølging anbefales dersom tilsvarende hendelser oppstår på nytt."
  ],
  "TelecareIP / NISM (pasientvarsling)|NISM GUI / statusbilde": [
    "NISM GUI er kontrollert.",
    "Statusbildet viser normal tilgjengelighet for relevante komponenter.",
    "Eventuelle enheter med avvik bør følges opp videre i egen sak."
  ],
  "TelecareIP / NISM (pasientvarsling)|Backup": [
    "Backup er kontrollert i forbindelse med årlig kontroll.",
    "Dersom backup ikke er verifisert, bør dette følges opp med kundens IT eller via fjerntilgang.",
    "Backup-status bør dokumenteres dersom det oppdages avvik."
  ],
  "TelecareIP / NISM (pasientvarsling)|Funksjonstest": [
    "Funksjonstest av pasientvarsling er gjennomført.",
    "Varsling fra rom/beboerutstyr bør kontrolleres mot mottak på relevant enhet.",
    "Eventuelle avvik bør registreres med romnummer, tidspunkt og videre tiltak."
  ],
  "TelecareIP / NISM (pasientvarsling)|Smykker / beboerutstyr": [
    "Smykker/beboerutstyr er gjennomgått der dette var relevant.",
    "Enheter som står offline, men fortsatt er aktive, bør kontrolleres eller settes ut av aktiv bruk.",
    "Kunde er informert om videre håndtering av aktuelle enheter."
  ],
  "AWA View|Varsling / alarmflyt": [
    "AWA View er kontrollert med tanke på visning og alarmflyt.",
    "Dersom alarmer ikke oppdateres korrekt i visningen, bør relevante tjenester restartes og funksjon testes på nytt.",
    "Varsler som sendes til feil mottakergruppe bør følges opp i konfigurasjon/ruting."
  ],
  "Unite / Ascom-system|Logg / hendelseslogg": [
    "Unite-relaterte logger er gjennomgått.",
    "Det er ikke observert gjentakende feil som tilsier kritisk påvirkning på meldingsflyt.",
    "Ved nye hendelser anbefales det å kontrollere tidspunkt opp mot kundens nettverk og integrasjoner."
  ],
  "IP-DECT / telefoni|Funksjonstest": [
    "IP-DECT/telefoni er funksjonstestet der dette var relevant.",
    "Innkommende og utgående tale bør verifiseres ved behov.",
    "Eventuelle deknings- eller registreringsavvik bør følges opp separat."
  ],
  "Fjerndrift / tilgang|Fjerndrift": [
    "Fjerntilgang er kontrollert der dette var mulig.",
    "Dersom fjerntilgang ikke fungerer, bør dette følges opp sammen med kundens IT.",
    "Manglende tilgang kan begrense muligheten for full kontroll og videre feilsøking."
  ]
};

const genericSuggestions = [
  "Ingen kritiske avvik observert på kontrolltidspunktet.",
  "Kunde er informert om observasjonen og videre anbefalt oppfølging.",
  "Forholdet anbefales fulgt opp dersom feilen oppstår på nytt.",
  "Det er opprettet eller anbefalt egen sak for videre oppfølging."
];

function getValue(id) {
  const el = $(id);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked;
  return el.value.trim();
}

function setValue(id, value) {
  const el = $(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = Boolean(value);
  else el.value = value || "";
}

function getPayload(targetId) {
  return {
    mode: "single",
    system: getValue("system"),
    area: getValue("area"),
    status: getValue("status"),
    style: getValue("style"),
    contact: getValue("contact"),
    noNewFacts: getValue("noNewFacts"),
    keepTechnical: getValue("keepTechnical"),
    noSensitive: getValue("noSensitive"),
    targetId,
    sectionTitle: $(targetId).dataset.sectionTitle,
    sectionText: getValue(targetId)
  };
}

function saveDraft() {
  const data = {};
  for (const id of allFields) {
    const el = $(id);
    if (!el) continue;
    data[id] = el.type === "checkbox" ? el.checked : el.value;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const [id, value] of Object.entries(data)) setValue(id, value);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function reportText() {
  const contact = getValue("contact");
  const summaryTitle = contact ? `OPPSUMMERING FRA KUNDESAMTALE MED: ${contact}` : "OPPSUMMERING FRA KUNDESAMTALE MED:";
  return [
    summaryTitle, getValue("summary"), "",
    "OPPDATERINGER OG OPPGRADERINGER:", getValue("updates"), "",
    "UTBEDRINGER OG ENDRINGER:", getValue("fixes"), "",
    "OBSERVASJON:", getValue("observation"), "",
    "KONKLUSJON:", getValue("conclusion")
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function setBusy(targetId, busy) {
  const buttons = document.querySelectorAll(`[data-target="${targetId}"]`);
  for (const btn of buttons) btn.disabled = busy;
  const generateBtn = document.querySelector(`.generate-one[data-target="${targetId}"]`);
  if (generateBtn) generateBtn.textContent = busy ? "Formulerer..." : "Generer forslag";
}

async function generateField(targetId) {
  const payload = getPayload(targetId);
  const hasText = payload.sectionText.trim().length > 0;
  if (!hasText && payload.status === "Ikke valgt") {
    const proceed = confirm("Feltet er tomt og status er ikke valgt. AI kan lage et generelt forslag, men det blir bedre hvis du velger status først. Vil du fortsette?");
    if (!proceed) return;
  }
  previousValues[targetId] = getValue(targetId);
  setBusy(targetId, true);
  try {
    const response = await fetch("/api/formulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Ukjent feil.");
    setValue(targetId, (result.text || "").trim());
    saveDraft();
  } catch (err) {
    alert(`Det oppstod en feil:\n\n${err.message}\n\nSjekk GITHUB_TOKEN, GITHUB_MODEL og at tokenet har Models: Read-only.`);
  } finally {
    setBusy(targetId, false);
  }
}

function undoField(targetId) {
  if (previousValues[targetId] === undefined) {
    alert("Ingen tidligere tekst å angre til for dette feltet.");
    return;
  }
  setValue(targetId, previousValues[targetId]);
  saveDraft();
}

async function copyText(text, btn) {
  if (!text.trim()) {
    alert("Det er ingen tekst å kopiere.");
    return;
  }
  await navigator.clipboard.writeText(text);
  const old = btn.textContent;
  btn.textContent = "Kopiert!";
  setTimeout(() => btn.textContent = old, 1200);
}

function updateHints() {
  const key = `${getValue("system")}|${getValue("area")}`;
  const items = suggestionMap[key] || genericSuggestions;
  $("hintText").textContent = `${getValue("system")} → ${getValue("area")} → ${getValue("status")}`;
  $("chips").innerHTML = "";
  for (const item of items) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = item;
    chip.addEventListener("click", () => {
      const current = getValue(activeTextareaId);
      setValue(activeTextareaId, current ? `${current}\n${item}` : item);
      saveDraft();
      $(activeTextareaId).focus();
    });
    $("chips").appendChild(chip);
  }
}

function loadExample() {
  setValue("contact", "Kari");
  setValue("system", "TelecareIP / NISM (pasientvarsling)");
  setValue("area", "Logg / hendelseslogg");
  setValue("status", "Ingen avvik");
  setValue("style", "kundevennlig");
  setValue("summary", "Pasientvarsling fungerer som forventet og kunden hadde ingenting spesielt å melde.");
  setValue("updates", "Ingen oppdatering eller oppgradering utført.");
  setValue("fixes", "Ingen utbedringer eller endringer utført.");
  setValue("observation", "Sjekket logg i NISM. Ikke noe kritisk. Noe gamle meldinger, men ikke noe som påvirker drift.");
  setValue("conclusion", "Ingen kritiske feil. Pasientvarsling fungerer som forventet. Kunde var generelt fornøyd.");
  updateHints();
  saveDraft();
}

document.querySelectorAll(".generate-one").forEach(btn => btn.addEventListener("click", () => generateField(btn.dataset.target)));
document.querySelectorAll(".undo-one").forEach(btn => btn.addEventListener("click", () => undoField(btn.dataset.target)));
document.querySelectorAll(".copy-one").forEach(btn => btn.addEventListener("click", () => copyText(getValue(btn.dataset.target), btn)));
for (const id of textFields) $(id).addEventListener("focus", () => activeTextareaId = id);
$("copyReportBtn").addEventListener("click", (e) => copyText(reportText(), e.target));
$("clearBtn").addEventListener("click", () => {
  if (!confirm("Vil du tømme alle feltene?")) return;
  for (const id of ["contact", ...textFields]) setValue(id, "");
  localStorage.removeItem(STORAGE_KEY);
});
$("exampleBtn").addEventListener("click", loadExample);
for (const id of allFields) {
  const el = $(id);
  if (!el) continue;
  el.addEventListener("input", saveDraft);
  el.addEventListener("change", () => {
    saveDraft();
    if (["system", "area", "status"].includes(id)) updateHints();
  });
}
loadDraft();
updateHints();
