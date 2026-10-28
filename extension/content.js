const APP_ID = "936619743392459";

const cookie = (nom) => (document.cookie.match(new RegExp(`(?:^|;\\s*)${nom}=([^;]+)`)) || [])[1];

async function bloquer(id) {
  try {
    const reponse = await fetch(`/api/v1/web/friendships/${id}/block/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRFToken": cookie("csrftoken") || "",
        "X-IG-App-ID": APP_ID,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "",
    });
    const corps = await reponse.json().catch(() => ({}));
    return {
      ok: reponse.ok && corps.status === "ok",
      http: reponse.status,
      message: corps.message || "",
      spam: Boolean(corps.spam),
      erreur: corps.status && corps.status !== "ok" ? corps.status : "",
    };
  } catch (e) {
    return { ok: false, http: 0, message: "", spam: false, erreur: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _expediteur, repondre) => {
  if (msg.type !== "bloquer") return;
  bloquer(msg.id).then(repondre);
  return true;
});

// --- Bandeau de progression flottant ---

const hote = document.createElement("div");
const ombre = hote.attachShadow({ mode: "open" });
ombre.innerHTML = `
  <style>
    .panneau { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 300px;
      font: 13px/1.4 -apple-system, system-ui, sans-serif; color: #111; background: #fff;
      border: 1px solid #dbdbdb; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.15); }
    .entete { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px;
      cursor: pointer; font-weight: 600; }
    .corps { padding: 0 12px 12px; }
    .replie .corps { display: none; }
    .barre { height: 8px; background: #efefef; border-radius: 4px; overflow: hidden; margin: 4px 0 8px; }
    .remplissage { height: 100%; background: #0095f6; transition: width .3s; }
    .statut { margin-bottom: 4px; }
    .discret { color: #737373; font-size: 12px; }
    .alerte { color: #c62828; }
    @media (prefers-color-scheme: dark) {
      .panneau { color: #f5f5f5; background: #262626; border-color: #363636; }
      .barre { background: #363636; }
      .discret { color: #a8a8a8; }
      .alerte { color: #ff6b6b; }
    }
  </style>
  <div class="panneau" hidden>
    <div class="entete"><span>Bloqueur Instagram</span><span class="resume"></span></div>
    <div class="corps">
      <div class="barre"><div class="remplissage"></div></div>
      <div class="statut"></div>
      <div class="estimation discret"></div>
      <div class="pourquoi discret"></div>
    </div>
  </div>`;
document.documentElement.appendChild(hote);

const $ = (sel) => ombre.querySelector(sel);
let etatCourant = null;

function afficher() {
  if (!etatCourant) return;
  const panneau = $(".panneau");
  panneau.hidden = etatCourant.statut.code === "inactif";
  if (panneau.hidden) return;
  const d = decrireEtat(etatCourant);
  panneau.classList.toggle("replie", Boolean(etatCourant.bandeauReplie));
  $(".resume").textContent = `${d.faits + d.echecs}/${d.total} · ${d.pourcent} %`;
  $(".remplissage").style.width = `${d.pourcent}%`;
  $(".statut").textContent = d.statut;
  $(".statut").classList.toggle("alerte", etatCourant.statut.code === "bloque-ig");
  $(".estimation").textContent = d.estimation;
  $(".pourquoi").textContent = `Pourquoi c'est lent ? ${explicationLenteur(etatCourant.reglages)}`;
}

async function recharger() {
  etatCourant = avecDefauts(await chrome.storage.local.get(null));
  afficher();
}

$(".entete").addEventListener("click", () => {
  chrome.storage.local.set({ bandeauReplie: !etatCourant?.bandeauReplie });
});
chrome.storage.onChanged.addListener(recharger);
setInterval(afficher, 1000);
recharger();
