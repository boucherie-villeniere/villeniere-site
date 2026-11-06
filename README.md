# Boucherie Villenière — site

Site vitrine + click & collect. Astro 7 (pages statiques), Keystatic (admin pour le boucher), hébergement Cloudflare Workers (gratuit, usage commercial autorisé, pas de limite de publications gênante).

## Lancer en local

```bash
npm install
npm run dev
```

- Site : http://localhost:4321
- Admin : http://localhost:4321/keystatic (en local, les modifications sont écrites directement dans `src/content/`)

## Où est quoi

| Contenu | Fichier | Éditable dans l'admin |
|---|---|---|
| Adresse, téléphones, horaires, bandeau d'annonce, mentions légales | `src/content/reglages.yaml` | Horaires, adresse & contact |
| Accueil, La boucherie | `src/content/accueil.yaml`, `boucherie.yaml` | Pages du site |
| Nos produits : textes et questions de l'expérience | `src/content/produits.yaml` | Nos produits |
| Viandes, cuissons, morceaux (rattachés à une viande + une ou plusieurs cuissons) | `src/content/viandes/`, `cuissons/`, `morceaux/` | Nos produits |
| Plats du click & collect | `src/content/plats/*.yaml` | Plats à commander |
| Créneaux, jours, heure limite, fermetures, e-mail de réception | `src/content/click-collect.yaml` | Réglages du click & collect |
| Photos | `public/images/…` | Envoyées depuis l'admin |
| Logo, frise, motif (extraits des .ai) | `public/brand/` | — |
| Couleurs et typos | `src/styles/global.css` | — |

## Click & collect : fonctionnement

1. Le client choisit un jour (à partir du lendemain si avant l'heure limite, sinon du surlendemain), un créneau, ses plats et laisse nom + téléphone.
2. `src/pages/api/commande.ts` revérifie tout côté serveur (dates, disponibilité des plats par jour, quantités max), puis envoie un e-mail à la boucherie (et un récapitulatif au client s'il a donné son e-mail).
3. La commande est enregistrée dans Cloudflare D1 (`src/lib/stockage.ts`, table créée automatiquement).
4. Paiement en boutique au retrait. Règles partagées navigateur/serveur : `src/lib/commande.ts`.

E-mails (`src/lib/emails.ts`, gabarit aux couleurs de la boutique) : un à la boucherie, un au client s'il a laissé son e-mail (objet, titre et textes modifiables dans l'admin, « Réglages du click & collect »).

### Planning des commandes : `/commandes`

Page réservée à la boutique (mot de passe = secret `COMMANDES_MOT_DE_PASSE`, connexion gardée 30 jours) : semaine en calendrier, détail du jour par créneau, quantités à préparer, statut de chaque commande (à préparer, prête, retirée, annulée). La page se rafraîchit toute seule toutes les 3 minutes.

Récapitulatif du matin : chaque jour de retrait à 8 h (Paris), un e-mail liste les commandes du jour (`src/worker.ts`, déclencheur `triggers.crons` dans `wrangler.jsonc`). La même tâche supprime chaque jour les commandes retirées depuis plus de 90 jours, comme annoncé dans les mentions légales.

## Temps forts (Noël, Halloween, Galette…)

Admin → « Temps forts » : dates de début/fin (vérifiées dans le navigateur, rien à republier le jour J), popup à l'ouverture et/ou bloc sur l'accueil, page dédiée (`/noel`…), décor, image, texte. Aperçu avant la date : `/?apercu=noel`.

**Carte** (même fiche) : rubriques, produits, prix, variantes en colonnes (ex. farces), encadrés illustrés. Affichée sur la page du temps fort. **Commande en ligne** depuis la carte (bouton « + » sur chaque ligne, panier en bas de page) : à activer dans « Commande en ligne » de la carte, avec date limite et fenêtre de retrait ; jours et créneaux = ceux du click & collect. Produits au kilo : le client indique un poids (viandes) ou un nombre de personnes (volailles), et peut choisir une farce ; sans poids de référence, le produit reste « à la pesée » et aucun montant à 0 € n'est affiché. Les commandes arrivent dans le planning avec l'étiquette du temps fort (`src/lib/evenement.ts`).

Version imprimable A5 réservée à la boutique : bouton « Ouvrir le menu à imprimer » en bas de la fiche du temps fort dans l'admin → `/commandes/menu/<page>` (accès : session de l'admin avec droit d'écriture sur le dépôt, vérifié auprès de GitHub, ou mot de passe du planning ; répartition automatique, mode « Livret » = 2 pages A5 par A4 dans l'ordre de pliage, QR code vers la page de commande). Dessins de la charte : `public/brand/noel` (extraits de `Villeniere_MenuNoel-assets.ai`).

## Mise en ligne (Cloudflare Workers)

1. Dépôt GitHub `boucherie-villeniere/villeniere-site` (public : aucun secret dedans, `.env` est ignoré).
2. Cloudflare → Workers & Pages → *Create* → *Import a repository* → ce dépôt. Build : `npm run build`, déploiement : `npx wrangler deploy` (config dans `wrangler.jsonc`).
3. Variables **de build** (Settings → Build → Variables and secrets) — lues au moment du build :
   - `PUBLIC_KEYSTATIC_GITHUB_REPO` = `boucherie-villeniere/villeniere-site`
   - `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` = `boucherie-villeniere-keystatic`
4. Secrets **d'exécution** (Settings → Variables and Secrets, type *Secret*) — lus à chaque requête :
   - `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` (app GitHub « boucherie-villeniere-keystatic »)
   - `RESEND_API_KEY` (compte Resend, domaine `boucherie-villeniere.fr` vérifié par DNS)
   - `COMMANDES_MOT_DE_PASSE` (accès à la page `/commandes`)
5. Dans l'app GitHub (Settings → Developer settings → GitHub Apps), chaque adresse du site doit avoir son *Callback URL* : `https://<adresse>/api/keystatic/github/oauth/callback`.
6. Domaine : Cloudflare → le Worker → Settings → Domains & Routes → *Custom domain*. Le domaine reste chez OVH (DNS et e-mails), on y ajoute les enregistrements demandés. Mettre aussi à jour `SITE_URL` dans `wrangler.jsonc`.

Tester localement comme en production : `npm run build` puis `npx astro preview`.

## À compléter avant la mise en ligne

- Horaires, SIRET, raison sociale, responsable de publication, e-mail de réception des commandes (`commandes@exemple.fr` actuellement).
- Textes définitifs (marqués « Texte provisoire ») et provenances par rayon.
- Photos : accueil, rayons, chaque plat.
- Plats et prix réels (les 4 plats actuels sont des exemples).
- Typo de titres : Playfair Display remplace Ivy Presto Display (charte). Pour utiliser l'originale, ajouter le kit Adobe Fonts dans `src/layouts/Base.astro` et passer `'ivypresto-display'` en tête de `--titre`.

## Évolutions prévues

- **Livraison** : réutilise le catalogue et la validation des commandes ; ajouter mode retrait/livraison, zones par code postal, frais, créneaux.
- **Camion / marchés** : collection Keystatic « emplacements » (marché, adresse, coordonnées, jours, horaires) + carte Leaflet/OpenStreetMap + bloc « cette semaine ».
- Paiement en ligne (Stripe Checkout) et quotas de plats par jour (stockage Cloudflare KV ou D1) si besoin.
Mise en ligne : novembre 2026
