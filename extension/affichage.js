// État et mise en forme, partagés entre le service worker, le popup et le bandeau sur instagram.com.

const ETAT_DEFAUT = {
  enCours: false,
  faits: {}, // id -> username
  echecs: {}, // id -> { username, raison }
  quota: { date: "", compte: 0 },
  prochaineAction: null, // timestamp de la prochaine alarme
  dernier: null, // dernier username bloqué
  statut: { code: "inactif", message: "" },
  reglages: { delaiMin: 30, delaiMax: 60, plafondJour: 150 },
};

const avecDefauts = (stocke) => ({ total: 0, ...structuredClone(ETAT_DEFAUT), ...stocke });

function dureeLisible(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (j) return `${j} j ${h} h`;
  if (h) return `${h} h ${String(m).padStart(2, "0")}`;
  if (m) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${s} s`;
}

const heureLisible = (ts) =>
  new Date(ts).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" });

// Estime la date de fin à partir du délai moyen et du plafond quotidien.
function estimerFin(etat, restants) {
  if (!restants) return null;
  const { delaiMin, delaiMax, plafondJour } = etat.reglages;
  const moyen = ((delaiMin + delaiMax) / 2) * 1000;
  const compteJour = etat.quota.date === new Date().toLocaleDateString("sv") ? etat.quota.compte : 0;
  const resteAujourdhui = Math.max(0, plafondJour - compteJour);
  if (restants <= resteAujourdhui) return Date.now() + restants * moyen;

  const minuit = new Date();
  minuit.setHours(24, 10, 0, 0);
  const apres = restants - resteAujourdhui;
  const joursPleins = Math.ceil(apres / plafondJour) - 1;
  const dernierJour = apres - joursPleins * plafondJour;
  return minuit.getTime() + joursPleins * 86400000 + dernierJour * moyen;
}

function decrireEtat(etat) {
  const total = etat.total || 0;
  const faits = Object.keys(etat.faits || {}).length;
  const echecs = Object.keys(etat.echecs || {}).length;
  const traites = faits + echecs;
  const restants = Math.max(0, total - traites);
  const pourcent = total ? Math.round((traites / total) * 100) : 0;
  const { plafondJour } = etat.reglages;
  const reste = etat.prochaineAction ? etat.prochaineAction - Date.now() : 0;

  let statut;
  switch (etat.statut.code) {
    case "attente":
      statut = reste > 1000 ? `Prochain blocage dans ${dureeLisible(reste)}` : "Blocage en cours…";
      break;
    case "quota":
      statut = `Quota du jour atteint (${plafondJour}/${plafondJour}) : reprise automatique ${heureLisible(etat.prochaineAction)}.`;
      break;
    case "sans-onglet":
      statut = `Ouvre ou recharge un onglet instagram.com pour continuer (nouvel essai dans ${dureeLisible(reste)}).`;
      break;
    case "bloque-ig":
      statut = `Pause de sécurité : Instagram signale trop d'actions (${etat.statut.message}). Attends quelques heures avant de reprendre.`;
      break;
    case "pause":
      statut = "En pause.";
      break;
    case "termine":
      statut = `Terminé : ${faits} comptes bloqués, ${echecs} échecs.`;
      break;
    default:
      statut = total ? "Prêt. Clique sur Démarrer." : "La liste est vide : génère blocklist.js d'abord.";
  }

  const actif = etat.enCours && restants > 0;
  const fin = actif ? estimerFin(etat, restants) : null;
  const estimation = fin ? `≈ ${dureeLisible(fin - Date.now())} restants, fin estimée ${heureLisible(fin)}` : "";

  return { total, faits, echecs, restants, pourcent, statut, estimation };
}

function explicationLenteur(reglages) {
  return (
    "Instagram limite le nombre d'actions par heure et par jour. Bloquer trop vite déclenche un " +
    "« Action bloquée », voire une restriction du compte. On espace donc les blocages de " +
    `${reglages.delaiMin} à ${reglages.delaiMax} s et on s'arrête à ${reglages.plafondJour} par jour.`
  );
}
