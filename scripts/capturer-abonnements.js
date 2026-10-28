// Capture les abonnements (following) d'un compte en écoutant les requêtes du site lui-même,
// sans en envoyer de nouvelles : à utiliser quand extraire-abonnements.js reçoit des 429.
// Usage : ouvrir le profil du compte sur https://www.instagram.com, coller ce script dans la
// console DevTools, puis cliquer sur « suivi(e)s ». La liste défile toute seule ; blocklist.js
// est téléchargé quand plus rien ne se charge (ou en tapant terminerCapture() dans la console).
(() => {
  const CALME_MAX = 8; // tours de défilement sans nouveau compte avant de conclure

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const cookie = (nom) =>
    (document.cookie.match(new RegExp(`(?:^|;\\s*)${nom}=([^;]+)`)) || [])[1];
  const moi = cookie("ds_user_id");
  const cible = location.pathname.split("/").filter(Boolean)[0] || "inconnu";
  const comptes = new Map();
  let fini = false;

  function ajouter(u) {
    const id = String(u.pk_id ?? u.pk ?? u.id ?? "");
    if (id && u.username && id !== moi) comptes.set(id, u.username);
  }

  // Parcourt une réponse JSON et récupère les comptes de la liste d'abonnements.
  function analyser(url, statut, texte) {
    if (statut === 429) {
      console.warn("Instagram renvoie aussi des 429 au site : compte limité, réessaie dans quelques heures.");
      return;
    }
    const pertinent =
      /\/friendships\/\d+\/following/.test(url) ||
      /edge_follow|friendships__following/.test(texte);
    if (!pertinent) return;
    let json;
    try {
      json = JSON.parse(texte);
    } catch {
      return;
    }
    const avant = comptes.size;
    (function parcourir(noeud) {
      if (Array.isArray(noeud)) return noeud.forEach(parcourir);
      if (!noeud || typeof noeud !== "object") return;
      if (noeud.username && (noeud.pk || noeud.pk_id || noeud.id)) ajouter(noeud);
      Object.values(noeud).forEach(parcourir);
    })(json.users ?? json.data ?? json);
    if (comptes.size > avant) console.log(`${comptes.size} comptes capturés`);
  }

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  const fetchOrig = window.fetch;
  XMLHttpRequest.prototype.open = function (methode, url, ...reste) {
    this.__urlCapture = String(url);
    return xhrOpen.call(this, methode, url, ...reste);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      if (typeof this.response === "string" || this.responseType === "") {
        analyser(this.__urlCapture, this.status, this.responseText);
      }
    });
    return xhrSend.apply(this, args);
  };
  window.fetch = async (...args) => {
    const reponse = await fetchOrig(...args);
    const url = String(args[0]?.url ?? args[0]);
    reponse
      .clone()
      .text()
      .then((texte) => analyser(url, reponse.status, texte))
      .catch(() => {});
    return reponse;
  };

  function telecharger() {
    if (fini) return;
    fini = true;
    XMLHttpRequest.prototype.open = xhrOpen;
    XMLHttpRequest.prototype.send = xhrSend;
    window.fetch = fetchOrig;
    if (!comptes.size) {
      console.warn("Aucun compte capturé. As-tu bien ouvert la liste « suivi(e)s » après avoir collé le script ?");
      return;
    }
    const lignes = [...comptes].map(
      ([id, username]) => `  { id: "${id}", username: "${username}" },`,
    );
    const contenu = [
      `// Généré le ${new Date().toLocaleString("fr-FR")} à partir des abonnements de @${cible}`,
      `// ${comptes.size} comptes (capture depuis la liste affichée).`,
      "const BLOCKLIST = [",
      ...lignes,
      "];",
      "",
    ].join("\n");
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(
      new Blob([contenu], { type: "text/javascript" }),
    );
    lien.download = "blocklist.js";
    lien.click();
    URL.revokeObjectURL(lien.href);
    console.log(
      `blocklist.js téléchargé (${comptes.size} comptes). Copie-le dans le dossier extension/.`,
    );
  }
  window.terminerCapture = telecharger;

  // Fait défiler la fenêtre « suivi(e)s » jusqu'à ce qu'il n'arrive plus rien.
  (async () => {
    let calme = 0;
    let dernierTotal = 0;
    console.log("Prêt : clique maintenant sur « suivi(e)s » sur le profil.");
    while (!fini) {
      await pause(2500 + Math.random() * 2500);
      const dialogue = document.querySelector('div[role="dialog"]');
      if (!dialogue) continue;
      const zone = [...dialogue.querySelectorAll("div")].find(
        (d) =>
          d.scrollHeight > d.clientHeight + 10 &&
          /auto|scroll/.test(getComputedStyle(d).overflowY),
      );
      if (!zone) continue;
      zone.scrollTop = zone.scrollHeight;
      calme = comptes.size > dernierTotal ? 0 : calme + 1;
      dernierTotal = comptes.size;
      if (calme >= CALME_MAX) telecharger();
    }
  })();
})();
