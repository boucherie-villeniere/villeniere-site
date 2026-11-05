# Boucherie Villenière — site

Site vitrine + click & collect. Astro 7 (pages statiques), Keystatic (admin pour le boucher), hébergement Netlify.

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
3. Paiement en boutique au retrait. Règles partagées navigateur/serveur : `src/lib/commande.ts`.

## Mise en ligne (Netlify)

1. Créer un dépôt GitHub privé et y pousser le projet.
2. Netlify → *Add new site* → importer le dépôt (build `npm run build`, détecté automatiquement).
3. Variables d'environnement Netlify (voir `.env.example`) :
   - `RESEND_API_KEY` : créer un compte Resend, vérifier le domaine `boucherie-villeniere.fr` (enregistrements DNS).
   - `PUBLIC_KEYSTATIC_GITHUB_REPO` = `compte/depot`.
4. Ouvrir `https://…/keystatic` en ligne : Keystatic propose de créer l'app GitHub et fournit les variables `KEYSTATIC_*` à ajouter dans Netlify.
5. Inviter le boucher comme collaborateur du dépôt GitHub : il se connecte à `/keystatic` avec son compte, chaque « Save » republie le site (~1 min).
6. Pointer le domaine `boucherie-villeniere.fr` vers Netlify, mettre à jour le lien en bio Instagram et la fiche Google.

## À compléter avant la mise en ligne

- Horaires, SIRET, raison sociale, responsable de publication, e-mail de réception des commandes (`commandes@exemple.fr` actuellement).
- Textes définitifs (marqués « Texte provisoire ») et provenances par rayon.
- Photos : accueil, rayons, chaque plat.
- Plats et prix réels (les 4 plats actuels sont des exemples).
- Typo de titres : Playfair Display remplace Ivy Presto Display (charte). Pour utiliser l'originale, ajouter le kit Adobe Fonts dans `src/layouts/Base.astro` et passer `'ivypresto-display'` en tête de `--titre`.

## Évolutions prévues

- **Livraison** : réutilise le catalogue et la validation des commandes ; ajouter mode retrait/livraison, zones par code postal, frais, créneaux.
- **Camion / marchés** : collection Keystatic « emplacements » (marché, adresse, coordonnées, jours, horaires) + carte Leaflet/OpenStreetMap + bloc « cette semaine ».
- Paiement en ligne (Stripe Checkout) et quotas de plats par jour (stockage Netlify Blobs) si besoin.
Mise en ligne : novembre 2026
