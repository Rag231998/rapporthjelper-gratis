const $ = (id) => document.getElementById(id);

const fields = ["contact","system","summary","updates","fixes","observations","conclusion","tickets"];
const checks = ["noNewFacts","fixLanguage","mergeRepeats","keepHeadings"];
const STORAGE_KEY = "rapporthjelper-gratis-v1";

function selectedStyle() {
  return document.querySelector('input[name="style"]:checked')?.value || "kundevennlig";
}

function getData() {
  const data = {};
  for (const id of fields) data[id] = $(id).value.trim();
  for (const id of checks) data[id] = $(id).checked;
  data.style = selectedStyle();
  return data;
}

function setOutput(text) {
  $("output").value = text || "";
  $("count").textContent = `${(text || "").length} tegn`;
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const id of fields) if (data[id] !== undefined) $(id).value = data[id];
    for (const id of checks) if (data[id] !== undefined) $(id).checked = Boolean(data[id]);
    if (data.style) {
      const r = document.querySelector(`input[name="style"][value="${data.style}"]`);
      if (r) r.checked = true;
    }
  } catch {}
}

async function generate() {
  const data = getData();
  const hasText = data.summary || data.updates || data.fixes || data.observations || data.conclusion;

  if (!hasText) {
    alert("Lim inn tekst i minst ett rapportfelt først.");
    return;
  }

  $("generateBtn").disabled = true;
  $("generateBtn").textContent = "Formulerer...";

  try {
    const response = await fetch("/api/formulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Ukjent feil.");

    setOutput(result.text);
    saveDraft();
  } catch (err) {
    setOutput(`Det oppstod en feil.

${err.message}

Sjekk:
1. At prosjektet ligger på Vercel
2. At GITHUB_TOKEN er lagt inn i Environment Variables
3. At tokenet har models:read
4. At valgt modell finnes i GitHub Models`);
  } finally {
    $("generateBtn").disabled = false;
    $("generateBtn").textContent = "Formuler direkte";
  }
}

function loadExample() {
  $("contact").value = "Kari";
  $("system").value = "Telecare / pasientvarslingssystem";
  $("summary").value = "Pasientvarsling fungerer som forventet og det var ingenting å melde fra kunden. Kunde hadde to telefoner som var defekt og ønsket å sende til reperasjon. Kunde har fått råd om å kontakte logistikk som kan bistå.";
  $("updates").value = "Ingen oppdatering eller oppgradering utført.";
  $("fixes").value = "Ingen utbedringer eller endringer utført.";
  $("observations").value = "Telecare: det er en del smykker som er offline, men som har status aktiv. Tekniker har gitt beskjed muntlig over telefon hvilke smykker og hva som må gjøres for å fikse.";
  $("conclusion").value = "Det er ingen kritiske feil å bemerke. Pasientvarsling fungerer som forventet og kunde hadde heller ingenting å ta opp ifm. varslingsystemet. Kunde var generelt fornøyd.";
  $("tickets").value = "";
  saveDraft();
}

$("generateBtn").addEventListener("click", generate);
$("exampleBtn").addEventListener("click", loadExample);

$("copyBtn").addEventListener("click", async () => {
  const text = $("output").value.trim();
  if (!text) return alert("Ingen ferdig tekst å kopiere.");
  await navigator.clipboard.writeText(text);
  $("copyBtn").textContent = "Kopiert!";
  setTimeout(() => $("copyBtn").textContent = "Kopier ferdig tekst", 1200);
});

$("clearBtn").addEventListener("click", () => {
  if (!confirm("Vil du tømme alt?")) return;
  for (const id of fields) {
    if ($(id).tagName !== "SELECT") $(id).value = "";
  }
  setOutput("");
  localStorage.removeItem(STORAGE_KEY);
});

$("output").addEventListener("input", () => $("count").textContent = `${$("output").value.length} tegn`);

for (const id of [...fields, ...checks]) {
  $(id).addEventListener("input", saveDraft);
  $(id).addEventListener("change", saveDraft);
}

for (const r of document.querySelectorAll('input[name="style"]')) {
  r.addEventListener("change", saveDraft);
}

loadDraft();
