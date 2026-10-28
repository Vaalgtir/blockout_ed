# Bloqueur Instagram

Extension Chrome qui bloque, depuis ton compte, une liste de comptes Instagram figée dans
`extension/blocklist.js`. Les blocages sont espacés (30 à 60 s par défaut, 150 par jour au
maximum) pour ne pas déclencher les restrictions anti-spam d'Instagram.

## 1. Générer la liste

1. Connecte-toi sur https://www.instagram.com dans Chrome.
2. Ouvre la console DevTools (`⌥⌘J`).
3. Copie le contenu de `scripts/extraire-abonnements.js`, remplace `pseudo_du_compte` par le
   compte dont tu veux récupérer les abonnements, colle-le et valide.
4. Un fichier `blocklist.js` est téléchargé : remplace `extension/blocklist.js` par celui-ci.

Si l'extraction s'interrompt (limite Instagram), le fichier téléchargé contient la liste
partielle, ce qui est indiqué dans son en-tête.

## 2. Installer l'extension

1. `chrome://extensions` → active le **mode développeur**.
2. **Charger l'extension non empaquetée** → choisis le dossier `extension/`.
3. Après chaque modification de `blocklist.js`, clique sur ↻ sur la carte de l'extension, puis
   recharge l'onglet Instagram.

## 3. Lancer

Garde un onglet instagram.com ouvert, ouvre le popup de l'extension et clique sur **Démarrer**.
La progression s'affiche dans le popup et dans un bandeau en bas à droite d'Instagram.

- Quand le quota du jour est atteint, l'extension reprend seule le lendemain (Chrome doit rester
  ouvert).
- Si Instagram signale trop d'actions, l'extension se met en pause : attends quelques heures avant
  de cliquer sur **Reprendre**, et réduis éventuellement le plafond dans les réglages.
- L'automatisation est contraire aux conditions d'utilisation d'Instagram : garde un rythme
  modéré.
