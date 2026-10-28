const $ = (id) => document.getElementById(id);
const envoyer = (msg) => chrome.runtime.sendMessage(msg);
let etat = null;

function afficher() {
  if (!etat) return;
  const d = decrireEtat(etat);
  const { reglages, quota } = etat;
  const quotaJour = quota.date === new Date().toLocaleDateString("sv") ? quota.compte : 0;

  $("compteur").textContent = `${d.faits + d.echecs} / ${d.total}`;
  $("pourcent").textContent = `${d.pourcent} %`;
  $("remplissage").style.width = `${d.pourcent}%`;
  $("statut").textContent = d.statut;
  $("statut").classList.toggle("alerte", etat.statut.code === "bloque-ig");
  $("estimation").textContent = d.estimation;
  $("dernier").textContent = etat.dernier ? `Dernier bloqué : @${etat.dernier}` : "";
  $("faits").textContent = d.faits;
  $("echecs").textContent = d.echecs;
  $("quota").textContent = `${quotaJour} / ${reglages.plafondJour}`;
  $("explication").textContent = explicationLenteur(reglages);

  $("demarrer").disabled = etat.enCours || d.restants === 0;
  $("demarrer").textContent = d.faits + d.echecs > 0 ? "Reprendre" : "Démarrer";
  $("pause").disabled = !etat.enCours;

  const echecs = Object.values(etat.echecs);
  $("blocEchecs").hidden = echecs.length === 0;
  $("listeEchecs").replaceChildren(
    ...echecs.map(({ username, raison }) => {
      const li = document.createElement("li");
      li.textContent = `@${username} : ${raison}`;
      return li;
    }),
  );
}

function remplirReglages() {
  const form = $("reglages");
  for (const [nom, valeur] of Object.entries(etat.reglages)) form.elements[nom].value = valeur;
}

async function recharger() {
  etat = avecDefauts(await chrome.storage.local.get(null));
  afficher();
}

$("demarrer").addEventListener("click", () => envoyer({ type: "demarrer" }));
$("pause").addEventListener("click", () => envoyer({ type: "pause" }));
$("reinitialiser").addEventListener("click", () => {
  if (confirm("Oublier la progression ? Les comptes déjà bloqués le resteront sur Instagram.")) {
    envoyer({ type: "reinitialiser" });
  }
});
$("reglages").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const delaiMin = Math.max(10, Number(f.delaiMin.value));
  const delaiMax = Math.max(delaiMin, Number(f.delaiMax.value));
  const plafondJour = Math.min(500, Math.max(1, Number(f.plafondJour.value)));
  envoyer({ type: "reglages", reglages: { delaiMin, delaiMax, plafondJour } });
});

chrome.storage.onChanged.addListener(recharger);
setInterval(afficher, 1000);
recharger().then(remplirReglages);
