// Extrait les abonnements (following) d'un compte Instagram et télécharge blocklist.js.
// Usage : être connecté sur https://www.instagram.com, ouvrir la console DevTools,
// modifier CIBLE ci-dessous, coller tout le script et valider.
// En cas d'interruption, relancer le même script : il reprend là où il s'était arrêté.
(async () => {
  const CIBLE = "blockout_extremedroitefrance";
  // Facultatif : l'ID numérique du compte, pour éviter la requête de profil (souvent limitée).
  const CIBLE_ID = "";

  const APP_ID = "936619743392459";
  const ATTENTES_429 = [60, 180, 600]; // secondes avant chaque nouvel essai
  const CLE_REPRISE = `extraction-abonnements-${CIBLE}`;

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const cookie = (nom) =>
    (document.cookie.match(new RegExp(`(?:^|;\\s*)${nom}=([^;]+)`)) || [])[1];
  // Mêmes en-têtes que le site web d'Instagram, pour ne pas être traité comme un robot.
  const entetes = () => ({
    "X-IG-App-ID": APP_ID,
    "X-ASBD-ID": "129477",
    "X-CSRFToken": cookie("csrftoken") || "",
    "X-IG-WWW-Claim": sessionStorage.getItem("www-claim-v2") || "0",
    "X-Requested-With": "XMLHttpRequest",
  });

  async function lireJson(url) {
    for (let essai = 0; ; essai++) {
      const reponse = await fetch(url, {
        credentials: "include",
        headers: entetes(),
      });
      if (reponse.ok) return reponse.json();
      if (reponse.status !== 429 || essai >= ATTENTES_429.length) {
        throw new Error(`HTTP ${reponse.status} sur ${url}`);
      }
      const attente = ATTENTES_429[essai];
      console.warn(
        `429 (trop de requêtes) : nouvel essai dans ${attente} s (${essai + 1}/${ATTENTES_429.length})…`,
      );
      await pause(attente * 1000);
    }
  }

  async function trouverId() {
    if (CIBLE_ID) return { id: CIBLE_ID, attendus: "?" };
    const profil = await lireJson(
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(CIBLE)}`,
    );
    const cible = profil?.data?.user;
    if (!cible) throw new Error(`Compte @${CIBLE} introuvable.`);
    if (cible.is_private && !cible.followed_by_viewer) {
      throw new Error(
        `@${CIBLE} est privé et tu ne le suis pas : sa liste d'abonnements est inaccessible.`,
      );
    }
    return { id: cible.id, attendus: cible.edge_follow?.count ?? "?" };
  }

  const reprise = JSON.parse(localStorage.getItem(CLE_REPRISE) || "null");
  const { id, attendus } = reprise || (await trouverId());
  const comptes = new Map(reprise?.comptes || []);
  let maxId = reprise?.maxId || "";
  let partiel = false;
  const moi = cookie("ds_user_id");

  console.log(
    reprise
      ? `Reprise de l'extraction de @${CIBLE} (${comptes.size} déjà récupérés)…`
      : `Extraction des abonnements de @${CIBLE} (${attendus} annoncés)…`,
  );
  try {
    do {
      const url = `/api/v1/friendships/${id}/following/?count=12${maxId ? `&max_id=${maxId}` : ""}`;
      const page = await lireJson(url);
      for (const u of page.users || []) {
        const uid = String(u.pk_id ?? u.pk);
        if (uid !== moi) comptes.set(uid, u.username);
      }
      maxId = page.next_max_id;
      localStorage.setItem(
        CLE_REPRISE,
        JSON.stringify({ id, attendus, maxId, comptes: [...comptes] }),
      );
      console.log(`${comptes.size} / ${attendus}`);
      // Pause entre les pages, au rythme d'un humain qui fait défiler la liste.
      if (maxId) await pause(3000 + Math.random() * 3000);
    } while (maxId);
    localStorage.removeItem(CLE_REPRISE);
  } catch (erreur) {
    partiel = true;
    console.warn(
      "Extraction interrompue. Attends au moins 30 min puis relance le script : " +
        "il reprendra ici. Téléchargement de la liste partielle en attendant.",
      erreur,
    );
  }

  if (!comptes.size) return;
  const lignes = [...comptes].map(
    ([uid, username]) => `  { id: "${uid}", username: "${username}" },`,
  );
  const contenu = [
    `// Généré le ${new Date().toLocaleString("fr-FR")} à partir des abonnements de @${CIBLE}`,
    `// ${comptes.size} comptes${partiel ? " (liste PARTIELLE, l'extraction a été interrompue)" : ""}.`,
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
})();
