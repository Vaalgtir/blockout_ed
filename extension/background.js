importScripts("blocklist.js", "affichage.js");

const ALARME = "prochain-blocage";

chrome.storage.local.set({ total: BLOCKLIST.length });

async function lireEtat() {
  const { total, ...etat } = avecDefauts(await chrome.storage.local.get(Object.keys(ETAT_DEFAUT)));
  return etat;
}

const dateDuJour = () => new Date().toLocaleDateString("sv"); // AAAA-MM-JJ, heure locale

function minuitProchain() {
  const d = new Date();
  d.setHours(24, 5 + Math.floor(Math.random() * 10), 0, 0);
  return d.getTime();
}

async function programmer(etat, quand, statut) {
  etat.prochaineAction = quand;
  etat.statut = statut;
  await chrome.alarms.create(ALARME, { when: quand });
  await chrome.storage.local.set(etat);
}

async function arreter(etat, statut) {
  etat.enCours = false;
  etat.prochaineAction = null;
  etat.statut = statut;
  await chrome.alarms.clear(ALARME);
  await chrome.storage.local.set(etat);
}

function delaiAleatoire({ delaiMin, delaiMax }) {
  return (delaiMin + Math.random() * (delaiMax - delaiMin)) * 1000;
}

// Réponses qui signifient qu'Instagram nous freine : on s'arrête net.
function estLimitation(r) {
  const texte = `${r.message} ${r.erreur}`.toLowerCase();
  return (
    r.http === 429 ||
    r.http === 401 ||
    r.spam ||
    /feedback_required|checkpoint_required|login_required|wait a few minutes|réessayer plus tard/.test(texte)
  );
}

async function traiterSuivant() {
  const etat = await lireEtat();
  if (!etat.enCours) return;

  const aujourdhui = dateDuJour();
  if (etat.quota.date !== aujourdhui) etat.quota = { date: aujourdhui, compte: 0 };
  if (etat.quota.compte >= etat.reglages.plafondJour) {
    return programmer(etat, minuitProchain(), { code: "quota", message: "" });
  }

  const suivant = BLOCKLIST.find((c) => !(c.id in etat.faits) && !(c.id in etat.echecs));
  if (!suivant) return arreter(etat, { code: "termine", message: "" });

  const [onglet] = await chrome.tabs.query({ url: "https://www.instagram.com/*" });
  let resultat = null;
  if (onglet) {
    resultat = await chrome.tabs.sendMessage(onglet.id, { type: "bloquer", id: suivant.id }).catch(() => null);
  }
  if (!resultat) {
    // Pas d'onglet, ou onglet ouvert avant l'installation de l'extension (pas de content script).
    return programmer(etat, Date.now() + 60_000, { code: "sans-onglet", message: "" });
  }

  if (resultat.ok) {
    etat.faits[suivant.id] = suivant.username;
    etat.dernier = suivant.username;
    etat.quota.compte++;
  } else if (estLimitation(resultat)) {
    const detail = resultat.message || resultat.erreur || `HTTP ${resultat.http}`;
    return arreter(etat, { code: "bloque-ig", message: detail });
  } else {
    const raison = resultat.message || resultat.erreur || `HTTP ${resultat.http}`;
    etat.echecs[suivant.id] = { username: suivant.username, raison };
  }

  return programmer(etat, Date.now() + delaiAleatoire(etat.reglages), { code: "attente", message: "" });
}

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME) traiterSuivant();
});

chrome.runtime.onMessage.addListener((msg, _expediteur, repondre) => {
  (async () => {
    const etat = await lireEtat();
    switch (msg.type) {
      case "demarrer":
        etat.enCours = true;
        await programmer(etat, Date.now() + 1000, { code: "attente", message: "" });
        break;
      case "pause":
        await arreter(etat, { code: "pause", message: "" });
        break;
      case "reinitialiser":
        // Le quota du jour est conservé : il reflète ce qu'Instagram a déjà vu aujourd'hui.
        etat.faits = {};
        etat.echecs = {};
        etat.dernier = null;
        await arreter(etat, { code: "inactif", message: "" });
        break;
      case "reglages":
        etat.reglages = msg.reglages;
        await chrome.storage.local.set({ reglages: etat.reglages });
        break;
    }
    repondre(true);
  })();
  return true;
});
